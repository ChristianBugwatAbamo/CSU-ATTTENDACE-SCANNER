import React, { useState, useEffect, useMemo } from 'react';
import {
  PieChart,
  Calendar,
  TrendingUp,
  Users,
  ChevronLeft,
  ChevronRight,
  Archive,
  BarChart3,
  Sparkles,
  Layers,
  Clock,
  MapPin,
  HeartHandshake,
  GraduationCap,
  Download,
  Filter,
  CheckCircle2,
  FileSpreadsheet,
  Building,
  UserCheck,
  AlertTriangle,
  AlertOctagon,
  Info,
  ShieldAlert,
  Phone,
  Eye,
  X,
  FileText,
  User
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { getSupabaseClient } from '../utils/supabaseClient';
import {
  evaluateCadetAttendance,
  sortCadetAlertsAscending,
  ACTIVE_FORMATION_DATES,
  toDateKey as normalizeDateKey
} from '../utils/attendanceRules';
import { reconcileRosterAttendance } from '../utils/attendanceStatus';

// Register Chart.js components + DataLabels plugin
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Filler,
  Legend,
  ChartDataLabels
);

// --- 1. Options for Attendance Trend (Percentages) ---
const attendanceChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  layout: {
    padding: {
      top: 24,
      right: 12,
      left: 4,
      bottom: 4,
    },
  },
  plugins: {
    legend: { display: false },
    datalabels: {
      display: true,
      align: 'top',
      anchor: 'end',
      offset: 4,
      clip: false,
      color: '#1e293b',
      font: { weight: 'bold', size: 11 },
      formatter: (value) => `${value}%`,
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 10 } } },
    y: {
      min: 0,
      max: 100,
      grid: { color: '#f1f5f9' },
      ticks: {
        font: { size: 10 },
        stepSize: 20,
        callback: (value) => `${value}%`,
      },
    },
  },
};

// --- 2. Options for Cadet Growth (Raw Totals) ---
const growthChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  layout: {
    padding: {
      top: 24,
      right: 12,
      left: 4,
      bottom: 4,
    },
  },
  plugins: {
    legend: { display: false },
    datalabels: {
      display: true,
      align: 'top',
      anchor: 'end',
      offset: 4,
      clip: false,
      color: '#1e293b',
      font: { weight: 'bold', size: 11 },
      formatter: (value) => `${value}`,
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 10 } } },
    y: {
      beginAtZero: true,
      grid: { color: '#f1f5f9' },
      ticks: { font: { size: 10 }, precision: 0 },
    },
  },
};

// --- 3. Options for College & Gender Grouped / Stacked Bar Chart ---
const createCollegeGenderOptions = (isStacked) => ({
  responsive: true,
  maintainAspectRatio: false,
  layout: {
    padding: { top: 22, right: 8, left: 4, bottom: 4 }
  },
  plugins: {
    legend: {
      display: true,
      position: 'top',
      align: 'end',
      labels: {
        boxWidth: 12,
        boxHeight: 12,
        usePointStyle: true,
        pointStyle: 'rectRounded',
        font: { size: 11, weight: 'bold' },
        color: '#475569'
      }
    },
    datalabels: {
      display: (ctx) => {
        const val = ctx.dataset.data[ctx.dataIndex];
        return val > 0;
      },
      align: isStacked ? 'center' : 'top',
      anchor: isStacked ? 'center' : 'end',
      offset: isStacked ? 0 : 2,
      color: isStacked ? '#ffffff' : '#1e293b',
      font: { weight: 'bold', size: 10 },
      formatter: (val) => `${val}`
    },
    tooltip: {
      backgroundColor: '#0f172a',
      titleFont: { size: 12, weight: 'bold' },
      padding: 10,
      cornerRadius: 8
    }
  },
  scales: {
    x: {
      stacked: isStacked,
      grid: { display: false },
      ticks: { font: { size: 11, weight: '600' }, color: '#334155' }
    },
    y: {
      stacked: isStacked,
      beginAtZero: true,
      grid: { color: '#f1f5f9' },
      ticks: { font: { size: 10 }, precision: 0 }
    }
  }
});

// --- 4. Options for Horizontal Ranking Bar Chart (Provinces) ---
const provinceRankingOptions = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  layout: {
    padding: { right: 40, left: 4, top: 4, bottom: 4 }
  },
  plugins: {
    legend: { display: false },
    datalabels: {
      display: true,
      align: 'right',
      anchor: 'end',
      offset: 6,
      color: '#065f46',
      font: { weight: 'bold', size: 11 },
      formatter: (val, ctx) => {
        const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
        const pct = total > 0 ? Math.round((val / total) * 100) : 0;
        return `${val} (${pct}%)`;
      }
    },
    tooltip: {
      backgroundColor: '#0f172a',
      padding: 10,
      cornerRadius: 8,
      callbacks: {
        label: (ctx) => ` ${ctx.parsed.x} Cadets`
      }
    }
  },
  scales: {
    x: {
      beginAtZero: true,
      grid: { color: '#f1f5f9' },
      ticks: { font: { size: 10 }, precision: 0 }
    },
    y: {
      grid: { display: false },
      ticks: { font: { size: 11, weight: '600' }, color: '#1e293b' }
    }
  }
};

// --- 5. Options for Demographics / Religion Donut Chart ---
const religionDonutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '66%',
  plugins: {
    legend: { display: false },
    datalabels: {
      display: (ctx) => {
        const val = ctx.dataset.data[ctx.dataIndex];
        const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
        const pct = total > 0 ? Math.round((val / total) * 100) : 0;
        return pct >= 5;
      },
      color: '#ffffff',
      font: { weight: 'bold', size: 10 },
      formatter: (val, ctx) => {
        const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
        const pct = total > 0 ? Math.round((val / total) * 100) : 0;
        return `${pct}%`;
      },
      textShadowColor: 'rgba(0, 0, 0, 0.45)',
      textShadowBlur: 4,
    },
    tooltip: {
      backgroundColor: '#0f172a',
      titleFont: { size: 12, weight: 'bold' },
      padding: 10,
      cornerRadius: 8,
      callbacks: {
        label: (ctx) => {
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
          const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
          return ` ${ctx.label}: ${ctx.parsed} Cadets (${pct}%)`;
        }
      }
    }
  }
};

// --- 6. Options for Department Donut Chart ---
const departmentDonutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '66%',
  plugins: {
    legend: { display: false },
    datalabels: {
      display: (ctx) => {
        const val = ctx.dataset.data[ctx.dataIndex];
        return val > 0;
      },
      color: '#ffffff',
      font: { weight: 'bold', size: 10 },
      formatter: (val, ctx) => {
        const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
        const pct = total > 0 ? Math.round((val / total) * 100) : 0;
        return pct >= 6 ? `${pct}%` : '';
      },
      textShadowColor: 'rgba(0, 0, 0, 0.45)',
      textShadowBlur: 4,
    },
    tooltip: {
      backgroundColor: '#0f172a',
      titleFont: { size: 12, weight: 'bold' },
      padding: 10,
      cornerRadius: 8,
      callbacks: {
        label: (ctx) => {
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
          const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
          return ` ${ctx.label}: ${ctx.parsed} Cadets (${pct}%)`;
        }
      }
    }
  }
};

function toDateKey(dateInput) {
  if (!dateInput) return '';
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
    return dateInput.slice(0, 10);
  }
  let d = new Date(dateInput);
  if (isNaN(d.getTime()) && typeof dateInput === 'string') {
    d = new Date(`${dateInput} ${new Date().getFullYear()}`);
  }
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function AnalyticsView({
  cadets: propsCadets = [],
  attendanceLogs: propsLogs = [],
  onRefresh,
  onNavigateToHistory
}) {
  const [selectedSemester, setSelectedSemester] = useState('1ST_SEM_2025_2026');
  const [isCollegeChartStacked, setIsCollegeChartStacked] = useState(false);
  const [flaggedCadets, setFlaggedCadets] = useState([]);
  const [evidenceCadet, setEvidenceCadet] = useState(null);

  // Multi-level Ascending Sort:
  // 1. Calculated Absences (0, 1, 2, 3...)
  // 2. Alert Status Tiers (Warning Threshold [1] -> Official Drop [2])
  // 3. Tardiness (Interval Lates) (0, 1, 2...)
  // 4. Missing Scans (0, 1, 2...)
  const sortedFlaggedCadets = useMemo(() => {
    return sortCadetAlertsAscending(flaggedCadets);
  }, [flaggedCadets]);

  const [liveCadets, setLiveCadets] = useState(() => {
    if (Array.isArray(propsCadets) && propsCadets.length > 0) return propsCadets;
    try {
      const saved = localStorage.getItem('csu_rotc_cadets_roster');
      if (saved) return JSON.parse(saved);
    } catch (_) { }
    return [];
  });

  useEffect(() => {
    if (Array.isArray(propsCadets) && propsCadets.length > 0) {
      setLiveCadets(propsCadets);
    }
  }, [propsCadets]);

  // Active Recorded Training Formation Dates (Aug 22, 24, 25, 26, 27, 28, 2026)
  const ACTIVE_FORMATION_DATES = [
    '2026-08-22',
    '2026-08-24',
    '2026-08-25',
    '2026-08-26',
    '2026-08-27',
    '2026-08-28'
  ];

  // Fetch and Evaluate Cadet Attendance against ROTC attendance rules across active formation days
  const fetchAndEvaluateAttendance = async () => {
    try {
      const client = getSupabaseClient();
      let cadetsData = [];
      let sessionsData = [];

      // 1. Fetch cadets with their attendance logs & recorded sessions from Supabase
      if (client) {
        const { data: cData, error: cErr } = await client
          .from('cadets')
          .select('id, name, battalion, company, platoon, contact_number, phone, emergency_contact, attendance_logs(date, status, session_date, timestamp, timeIn, timeOut, hasTimeIn, hasTimeOut)');
        if (!cErr && Array.isArray(cData) && cData.length > 0) {
          cadetsData = cData;
        }

        const { data: sData } = await client
          .from('attendance_sessions')
          .select('session_date, date');
        if (Array.isArray(sData)) {
          sessionsData = sData;
        }
      }

      // Fallback to props / local master roster + logs if Supabase query is unavailable or empty
      if (cadetsData.length === 0) {
        const sourceCadets = (propsCadets && propsCadets.length > 0) ? propsCadets : liveCadets;
        cadetsData = (sourceCadets || []).map(cadet => {
          const cId = String(cadet.id || cadet.cadet_id || '').trim().toUpperCase();
          const logs = (propsLogs || []).filter(l => String(l.cadet_id || l.cadetId || '').trim().toUpperCase() === cId);
          return {
            id: cadet.id || cadet.cadet_id || '',
            name: cadet.name || `${cadet.last_name || cadet.lastName || ''}, ${cadet.first_name || cadet.firstName || ''}`.trim(),
            battalion: cadet.battalion || '1st Battalion',
            company: cadet.company || 'Alpha Company',
            platoon: cadet.platoon || '1st Platoon',
            contact_number: cadet.contact_number || cadet.contactNumber || cadet.phone || '',
            attendance_logs: logs
          };
        });
      }

      // Build consolidated set of distinct formation dates: Combine default 6 active formation dates + any session/log dates
      const formationDatesSet = new Set(ACTIVE_FORMATION_DATES);
      sessionsData.forEach(s => {
        const dk = normalizeDateKey(s.session_date || s.date);
        if (dk) formationDatesSet.add(dk);
      });
      (propsLogs || []).forEach(l => {
        const dk = normalizeDateKey(l.date || l.session_date || l.timestamp);
        if (dk) formationDatesSet.add(dk);
      });
      cadetsData.forEach(c => {
        (c.attendance_logs || []).forEach(l => {
          const dk = normalizeDateKey(l.date || l.session_date || l.timestamp);
          if (dk) formationDatesSet.add(dk);
        });
      });

      // Sort formation dates chronologically
      const sortedFormationDates = Array.from(formationDatesSet).sort();

      // 2. Evaluate each cadet against ROTC attendance rules across every active formation date
      const evaluatedList = (cadetsData || []).map((cadet) => {
        return evaluateCadetAttendance(cadet, sortedFormationDates);
      });

      // Filter only cadets needing admin action and apply ascending multi-level sort
      const flagged = evaluatedList.filter((c) => c.status !== 'GOOD');
      setFlaggedCadets(sortCadetAlertsAscending(flagged));
    } catch (err) {
      console.error('Error evaluating attendance:', err);
    }
  };

  useEffect(() => {
    fetchAndEvaluateAttendance();
  }, [propsCadets, propsLogs]);

  const [growthData, setGrowthData] = useState({
    labels: ['Aug 22', 'Aug 23', 'Aug 24', 'Aug 25'],
    datasets: [{
      fill: true,
      label: 'Total Cadets Enrolled',
      data: [4, 7, 9, 11],
      borderColor: '#0284c7',
      backgroundColor: 'rgba(2, 132, 199, 0.15)',
      tension: 0.35,
      pointRadius: 4,
      pointBackgroundColor: '#0284c7',
    }]
  });

  const [trendData, setTrendData] = useState({
    labels: ['Aug 22', 'Aug 24'],
    datasets: [{
      fill: true,
      label: 'Muster Attendance Rate %',
      data: [100, 100],
      borderColor: '#0284c7',
      backgroundColor: 'rgba(2, 132, 199, 0.15)',
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: '#0284c7',
    }]
  });

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const client = getSupabaseClient();
        let totalCount = liveCadets?.length || propsCadets?.length || 11;
        const dailyEnrollmentMap = new Map();
        let fetchedCadetsList = [];

        if (client) {
          const { data: allCadets, error: cadetErr } = await client
            .from('cadets')
            .select('*')
            .order('created_at', { ascending: true });

          if (!cadetErr && Array.isArray(allCadets) && allCadets.length > 0) {
            fetchedCadetsList = allCadets;
            if (isMounted) {
              setLiveCadets(allCadets);
            }
            totalCount = allCadets.length;
          }
        }

        const cadetRecords = fetchedCadetsList.length > 0 ? fetchedCadetsList : (liveCadets && liveCadets.length > 0 ? liveCadets : propsCadets);

        if (cadetRecords && cadetRecords.length > 0) {
          cadetRecords.forEach(c => {
            const rawCreated = c.created_at || c.createdAt || c.timestamp || '2026-08-25';
            const d = new Date(rawCreated);
            const validDate = !isNaN(d.getTime()) ? d : new Date('2026-08-25');
            const dateKey = toDateKey(validDate);
            if (dateKey) {
              dailyEnrollmentMap.set(dateKey, (dailyEnrollmentMap.get(dateKey) || 0) + 1);
            }
          });
        }

        if (isMounted) {
          const sortedDates = Array.from(dailyEnrollmentMap.keys()).sort();
          let growthLabels = [];
          let growthCounts = [];

          if (sortedDates.length >= 2) {
            let cumulative = 0;
            growthLabels = sortedDates.map(k => {
              const [y, m, d] = k.split('-').map(Number);
              const dateObj = new Date(y, (m || 1) - 1, d || 1);
              return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            });
            growthCounts = sortedDates.map(k => {
              cumulative += (dailyEnrollmentMap.get(k) || 0);
              return cumulative;
            });
          } else if (sortedDates.length === 1) {
            const singleKey = sortedDates[0];
            const [y, m, d] = singleKey.split('-').map(Number);
            const dayNum = d || 25;
            const days = [
              Math.max(1, dayNum - 3),
              Math.max(2, dayNum - 2),
              Math.max(3, dayNum - 1),
              dayNum
            ];
            const targetTotal = totalCount > 0 ? totalCount : 11;
            growthLabels = days.map(dn => `Aug ${dn}`);
            growthCounts = [
              Math.max(1, Math.round(targetTotal * 0.35)),
              Math.max(2, Math.round(targetTotal * 0.65)),
              Math.max(3, Math.round(targetTotal * 0.85)),
              targetTotal
            ];
          } else {
            growthLabels = ['Aug 22', 'Aug 23', 'Aug 24', 'Aug 25'];
            growthCounts = [4, 7, 9, totalCount || 11];
          }

          setGrowthData({
            labels: growthLabels,
            datasets: [{
              fill: true,
              label: 'Total Cadets Enrolled',
              data: growthCounts,
              borderColor: '#0284c7',
              backgroundColor: 'rgba(2, 132, 199, 0.15)',
              tension: 0.35,
              pointRadius: 4,
              pointBackgroundColor: '#0284c7',
            }]
          });
        }

        const dailyDateMap = new Map();

        if (client) {
          const { data: logs, error: logsError } = await client
            .from('attendance_logs')
            .select('created_at, date, timestamp, status')
            .in('status', ['PRESENT', 'LATE', 'Present', 'Late']);

          if (!logsError && Array.isArray(logs) && logs.length > 0) {
            logs.forEach(curr => {
              const rawDate = curr.created_at || curr.date || curr.timestamp;
              const dateKey = toDateKey(rawDate) || toDateKey(new Date());
              if (dateKey) {
                dailyDateMap.set(dateKey, (dailyDateMap.get(dateKey) || 0) + 1);
              }
            });
          } else {
            const { data: sessions, error: sessErr } = await client
              .from('attendance_sessions')
              .select('session_date, present_count, late_count, total_scanned')
              .order('session_date', { ascending: true });

            if (!sessErr && Array.isArray(sessions) && sessions.length > 0) {
              sessions.forEach(curr => {
                const dateKey = toDateKey(curr.session_date);
                if (dateKey) {
                  const scanned = (curr.present_count !== undefined || curr.late_count !== undefined)
                    ? ((curr.present_count || 0) + (curr.late_count || 0))
                    : ((curr.total_scanned !== undefined && curr.total_scanned !== null) ? curr.total_scanned : 0);

                  dailyDateMap.set(dateKey, (dailyDateMap.get(dateKey) || 0) + (scanned || 0));
                }
              });
            }
          }
        }

        if (dailyDateMap.size === 0 && Array.isArray(propsLogs) && propsLogs.length > 0) {
          const logsByDate = new Map();
          propsLogs.forEach(l => {
            const rawStatus = String(l.status || l.timeInStatus || l.finalDailyStatus || '').toUpperCase();
            if (rawStatus === 'PRESENT' || rawStatus === 'LATE' || (rawStatus && rawStatus !== 'ABSENT' && rawStatus !== 'EXCUSED')) {
              const rawDate = l.date || l.timestamp || l.receivedAt;
              if (!rawDate) return;
              const dateKey = toDateKey(rawDate);
              if (!dateKey) return;
              if (!logsByDate.has(dateKey)) logsByDate.set(dateKey, new Set());
              const cid = String(l.cadetId || l.id || '').trim();
              if (cid) logsByDate.get(dateKey).add(cid);
            }
          });

          logsByDate.forEach((cadetSet, dateKey) => {
            dailyDateMap.set(dateKey, cadetSet.size);
          });
        }

        const unitCapacity = totalCount > 0 ? totalCount : 11;
        const sortedDateKeys = Array.from(dailyDateMap.keys()).sort();

        const labels = sortedDateKeys.map(key => {
          const [y, m, d] = key.split('-').map(Number);
          const dateObj = new Date(y, (m || 1) - 1, d || 1);
          return !isNaN(dateObj.getTime())
            ? dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : key;
        });

        const percentageRates = sortedDateKeys.map(key => {
          const attendedCount = dailyDateMap.get(key) || 0;
          const rate = Math.round(((attendedCount || 0) / unitCapacity) * 100);
          return rate > 100 ? 100 : (rate < 0 ? 0 : rate);
        });

        if (isMounted && labels.length > 0) {
          setTrendData({
            labels: labels.slice(-7),
            datasets: [{
              fill: true,
              label: 'Muster Attendance Rate %',
              data: percentageRates.slice(-7),
              borderColor: '#0284c7',
              backgroundColor: 'rgba(2, 132, 199, 0.15)',
              tension: 0.4,
              pointRadius: 4,
              pointBackgroundColor: '#0284c7',
            }]
          });
        }
      } catch (err) {
        console.error('Error loading analytics trend:', err);
      }
    }

    loadData();

    const handleCadetUpdated = (e) => {
      if (e?.detail) {
        setLiveCadets(prev => {
          const updated = e.detail;
          const targetId = String(updated.id || updated.cadetId || updated.cadet_id || '').toUpperCase();
          const exists = prev.some(c => String(c.id || c.cadetId || c.cadet_id || '').toUpperCase() === targetId);
          if (exists) {
            return prev.map(c => String(c.id || c.cadetId || c.cadet_id || '').toUpperCase() === targetId ? { ...c, ...updated } : c);
          }
          return [...prev, updated];
        });
      }
    };

    window.addEventListener('local-cadet-update', handleCadetUpdated);

    return () => {
      isMounted = false;
      window.removeEventListener('local-cadet-update', handleCadetUpdated);
    };
  }, [liveCadets.length, propsCadets, propsLogs]);

  const activeCadets = useMemo(() => {
    return liveCadets && liveCadets.length > 0 ? liveCadets : (propsCadets || []);
  }, [liveCadets, propsCadets]);

  const collegeGenderData = useMemo(() => {
    const colleges = [
      { key: 'CEGS', name: 'Engineering & Geosciences', male: 0, female: 0 },
      { key: 'CCIS', name: 'Computing & Info Sciences', male: 0, female: 0 },
      { key: 'CAA', name: 'Agriculture & Agri-Industries', male: 0, female: 0 },
      { key: 'CED', name: 'Education', male: 0, female: 0 },
      { key: 'CHASS', name: 'Humanities & Social Sciences', male: 0, female: 0 },
      { key: 'CMNS', name: 'Mathematics & Natural Sciences', male: 0, female: 0 },
      { key: 'COFES', name: 'Forestry & Environmental Sci', male: 0, female: 0 },
    ];

    const cadetList = activeCadets || [];

    cadetList.forEach(cadet => {
      const deptRaw = String(cadet.department || cadet.college || cadet.program || cadet.course || '').trim().toUpperCase();
      const isFemale = String(cadet.gender || '').toLowerCase() === 'female';

      let matched = null;
      if (deptRaw.includes('ENGIN') || deptRaw.includes('CEGS')) matched = colleges[0];
      else if (deptRaw.includes('COMPUT') || deptRaw.includes('CCIS') || deptRaw.includes('BSIS') || deptRaw.includes('BSCS') || deptRaw.includes('BSIT') || deptRaw.includes('IT') || deptRaw.includes('CS')) matched = colleges[1];
      else if (deptRaw.includes('AGRI') || deptRaw.includes('CAA')) matched = colleges[2];
      else if (deptRaw.includes('EDUC') || deptRaw.includes('CED')) matched = colleges[3];
      else if (deptRaw.includes('HUMAN') || deptRaw.includes('CHASS') || deptRaw.includes('ARTS')) matched = colleges[4];
      else if (deptRaw.includes('MATH') || deptRaw.includes('SCIENCE') || deptRaw.includes('CMNS')) matched = colleges[5];
      else if (deptRaw.includes('FOREST') || deptRaw.includes('COFES')) matched = colleges[6];

      if (matched) {
        if (isFemale) matched.female += 1;
        else matched.male += 1;
      }
    });

    const hasLiveCadets = cadetList.length > 0;
    const labels = colleges.map(c => c.key);
    const maleData = colleges.map((c, i) => hasLiveCadets ? c.male : [0, 0, 0, 0, 0, 0, 0][i]);
    const femaleData = colleges.map((c, i) => hasLiveCadets ? c.female : [0, 0, 0, 0, 0, 0, 0][i]);

    const totalMales = maleData.reduce((a, b) => a + b, 0);
    const totalFemales = femaleData.reduce((a, b) => a + b, 0);
    const grandTotal = totalMales + totalFemales;

    return {
      labels,
      totalMales,
      totalFemales,
      grandTotal,
      chartData: {
        labels,
        datasets: [
          {
            label: 'Male Cadets',
            data: maleData,
            backgroundColor: '#2563eb',
            hoverBackgroundColor: '#1d4ed8',
            borderRadius: isCollegeChartStacked ? 0 : 6,
            barPercentage: 0.75,
            categoryPercentage: 0.8
          },
          {
            label: 'Female Cadets',
            data: femaleData,
            backgroundColor: '#ec4899',
            hoverBackgroundColor: '#db2777',
            borderRadius: isCollegeChartStacked ? 4 : 6,
            barPercentage: 0.75,
            categoryPercentage: 0.8
          }
        ]
      }
    };
  }, [activeCadets, isCollegeChartStacked]);

  // =========================================================================
  // 2. DATASET: Geographic Origin (100% Dynamic - No Hardcoded List)
  // Extracts unique provinces directly from cadet database records
  // =========================================================================
  const provinceData = useMemo(() => {
    const countsMap = new Map();
    const cadetList = activeCadets || [];

    cadetList.forEach(cadet => {
      // Extract province directly from cadet record
      const raw = String(cadet.province || '').trim();

      if (!raw) {
        countsMap.set('Unspecified / Pending', (countsMap.get('Unspecified / Pending') || 0) + 1);
      } else {
        // Standardize clean casing (e.g. "Agusan del Norte", "Cebu", "Davao del Sur")
        const clean = raw.replace(/\s+/g, ' ');
        const formatted = clean
          .toLowerCase()
          .replace(/\b\w/g, c => c.toUpperCase())
          .replace(/\bDel\b/g, 'del')
          .replace(/\bDe\b/g, 'de')
          .replace(/\bNi\b/g, 'ni');

        countsMap.set(formatted, (countsMap.get(formatted) || 0) + 1);
      }
    });

    let list = Array.from(countsMap.entries()).map(([province, count]) => ({
      province,
      count
    }));

    // Sort by count descending, keeping Unspecified/Pending at the bottom of the list
    list.sort((a, b) => {
      const aIsPending = a.province.toLowerCase().includes('unspecified') || a.province.toLowerCase().includes('pending');
      const bIsPending = b.province.toLowerCase().includes('unspecified') || b.province.toLowerCase().includes('pending');
      if (aIsPending && !bIsPending) return 1;
      if (!aIsPending && bIsPending) return -1;
      return b.count - a.count;
    });

    if (list.length === 0) {
      list = [{ province: 'Unspecified / Pending', count: 0 }];
    }

    const totalProvincesCount = list.reduce((a, b) => a + b.count, 0);

    // Curated dynamic color palette: Slate Gray (#64748b) for Pending & Other, ROTC Green/Emerald for provinces
    const palette = ['#047857', '#059669', '#10b981', '#0ea5e9', '#6366f1', '#8b5cf6', '#14b8a6', '#3b82f6'];
    let palIndex = 0;

    const barColors = list.map(item => {
      const isPendingOrOther = item.province.toLowerCase().includes('unspecified') ||
        item.province.toLowerCase().includes('pending') ||
        item.province.toLowerCase().includes('other');
      if (isPendingOrOther) return '#64748b';
      const c = palette[palIndex % palette.length];
      palIndex++;
      return c;
    });

    return {
      list,
      totalProvincesCount,
      chartData: {
        labels: list.map(item => item.province),
        datasets: [
          {
            label: 'Enrolled Cadets',
            data: list.map(item => item.count),
            backgroundColor: barColors,
            borderRadius: 6,
            barThickness: 18
          }
        ]
      }
    };
  }, [activeCadets]);

  const religionData = useMemo(() => {
    // Distinct individual faith communities mapping with unique aesthetic colors
    const standardFaiths = {
      'ROMAN CATHOLIC': { name: 'Roman Catholic', color: '#047857' },
      'BAPTIST': { name: 'Baptist', color: '#0284c7' },
      'CHRISTIAN': { name: 'Christian', color: '#0ea5e9' },
      'SEVENTH-DAY': { name: 'Seventh-Day Adventist', color: '#d97706' },
      'BORN AGAIN': { name: 'Born Again', color: '#38bdf8' },
      'FREE METHODIST': { name: 'Free Methodist', color: '#6366f1' },
      'IGLESIA NI CRISTO': { name: 'Iglesia ni Cristo', color: '#8b5cf6' },
      'UNITED CHURCH OF CHRIST IN THE PHILIPPINES': { name: 'United Church of Christ (UCCP)', color: '#06b6d4' },
      'ISLAM': { name: 'Islam / Muslim', color: '#10b981' },
      'OTHERS': { name: 'Others', color: '#64748b' },
      'UNSPECIFIED': { name: 'Unspecified / Pending', color: '#64748b' }
    };

    const countsMap = new Map();
    // Initialize standard keys
    Object.keys(standardFaiths).forEach(k => countsMap.set(k, 0));

    const cadetList = activeCadets || [];

    cadetList.forEach(cadet => {
      const relRaw = String(cadet.religion || '').trim().toUpperCase();

      if (!relRaw) {
        countsMap.set('UNSPECIFIED', (countsMap.get('UNSPECIFIED') || 0) + 1);
      } else if (relRaw === 'ROMAN CATHOLIC' || relRaw.includes('CATHOLIC') || relRaw === 'RC') {
        countsMap.set('ROMAN CATHOLIC', (countsMap.get('ROMAN CATHOLIC') || 0) + 1);
      } else if (relRaw === 'BAPTIST') {
        countsMap.set('BAPTIST', (countsMap.get('BAPTIST') || 0) + 1);
      } else if (relRaw === 'CHRISTIAN') {
        countsMap.set('CHRISTIAN', (countsMap.get('CHRISTIAN') || 0) + 1);
      } else if (relRaw === 'BORN AGAIN' || relRaw.includes('BORN AGAIN') || relRaw.includes('EVANGELICAL')) {
        countsMap.set('BORN AGAIN', (countsMap.get('BORN AGAIN') || 0) + 1);
      } else if (relRaw === 'SEVENTH-DAY' || relRaw.includes('SEVENTH') || relRaw.includes('ADVENTIST') || relRaw === 'SDA') {
        countsMap.set('SEVENTH-DAY', (countsMap.get('SEVENTH-DAY') || 0) + 1);
      } else if (relRaw === 'FREE METHODIST') {
        countsMap.set('FREE METHODIST', (countsMap.get('FREE METHODIST') || 0) + 1);
      } else if (relRaw === 'IGLESIA NI CRISTO' || relRaw.includes('IGLESIA') || relRaw === 'INC') {
        countsMap.set('IGLESIA NI CRISTO', (countsMap.get('IGLESIA NI CRISTO') || 0) + 1);
      } else if (relRaw === 'UNITED CHURCH OF CHRIST IN THE PHILIPPINES' || relRaw.includes('UCCP') || relRaw.includes('UNITED CHURCH') || relRaw.includes('METHODIST')) {
        countsMap.set('UNITED CHURCH OF CHRIST IN THE PHILIPPINES', (countsMap.get('UNITED CHURCH OF CHRIST IN THE PHILIPPINES') || 0) + 1);
      } else if (relRaw === 'ISLAM' || relRaw.includes('MUSLIM')) {
        countsMap.set('ISLAM', (countsMap.get('ISLAM') || 0) + 1);
      } else if (relRaw === 'OTHERS') {
        countsMap.set('OTHERS', (countsMap.get('OTHERS') || 0) + 1);
      } else {
        // Dynamic custom religion record from Supabase
        if (!countsMap.has(relRaw)) {
          countsMap.set(relRaw, 0);
        }
        countsMap.set(relRaw, countsMap.get(relRaw) + 1);
      }
    });

    // Build the list with display names and colors
    let list = Array.from(countsMap.entries()).map(([key, count]) => {
      const config = standardFaiths[key] || {
        name: key,
        color: '#64748b'
      };
      return {
        key,
        name: config.name,
        count,
        color: config.color
      };
    });

    // Filter populated categories when live cadets exist, sorted by count
    const activeList = cadetList.length > 0 ? list.filter(item => item.count > 0) : list;
    activeList.sort((a, b) => b.count - a.count);

    const total = activeList.reduce((a, b) => a + b.count, 0);

    return {
      list: activeList.length > 0 ? activeList : list,
      total,
      chartData: {
        labels: (activeList.length > 0 ? activeList : list).map(item => item.name),
        datasets: [
          {
            data: (activeList.length > 0 ? activeList : list).map(item => item.count),
            backgroundColor: (activeList.length > 0 ? activeList : list).map(item => item.color),
            borderColor: '#ffffff',
            borderWidth: 2,
            hoverOffset: 6
          }
        ]
      }
    };
  }, [activeCadets]);

  const departmentDistribution = useMemo(() => {
    const cadetList = activeCadets || [];
    const counts = { CAA: 0, CCIS: 0, CED: 0, CEGS: 0, CHASS: 0, CMNS: 0, COFES: 0 };
    let unassignedCount = 0;

    cadetList.forEach(cadet => {
      const deptRaw = String(cadet.department || cadet.college || cadet.program || cadet.course || '').trim().toUpperCase();
      if (counts.hasOwnProperty(deptRaw)) {
        counts[deptRaw] += 1;
      } else if (deptRaw) {
        if (deptRaw.includes('AGRI') || deptRaw.includes('CAA')) counts.CAA += 1;
        else if (deptRaw.includes('COMPUT') || deptRaw.includes('CCIS') || deptRaw.includes('BSIS') || deptRaw.includes('BSCS') || deptRaw.includes('BSIT') || deptRaw.includes('IT') || deptRaw.includes('CS')) counts.CCIS += 1;
        else if (deptRaw.includes('EDUC') || deptRaw.includes('CED')) counts.CED += 1;
        else if (deptRaw.includes('ENGIN') || deptRaw.includes('CEGS')) counts.CEGS += 1;
        else if (deptRaw.includes('HUMAN') || deptRaw.includes('CHASS') || deptRaw.includes('ARTS')) counts.CHASS += 1;
        else if (deptRaw.includes('MATH') || deptRaw.includes('SCIENCE') || deptRaw.includes('CMNS')) counts.CMNS += 1;
        else if (deptRaw.includes('FOREST') || deptRaw.includes('COFES')) counts.COFES += 1;
        else unassignedCount += 1;
      } else {
        unassignedCount += 1;
      }
    });

    const totalCalculated = Object.values(counts).reduce((a, b) => a + b, 0) + unassignedCount;

    const deptList = [
      { key: 'CEGS', name: 'College of Engineering & Geosciences', color: '#881337', count: counts.CEGS },
      { key: 'CCIS', name: 'College of Computing & Information Sciences', color: '#F97316', count: counts.CCIS },
      { key: 'CAA', name: 'College of Agriculture & Agri-Industries', color: '#EAB308', count: counts.CAA },
      { key: 'CED', name: 'College of Education', color: '#3B82F6', count: counts.CED },
      { key: 'CHASS', name: 'College of Humanities & Social Sciences', color: '#8B5CF6', count: counts.CHASS },
      { key: 'CMNS', name: 'College of Mathematics & Natural Sciences', color: '#EF4444', count: counts.CMNS },
      { key: 'COFES', name: 'College of Forestry & Environmental Science', color: '#10B981', count: counts.COFES },
    ];

    if (unassignedCount > 0) {
      deptList.push({ key: 'OTHER', name: 'Unassigned / Pending', color: '#64748b', count: unassignedCount });
    }

    const hasData = deptList.some(d => d.count > 0);

    const chartData = {
      labels: deptList.map(d => d.key),
      datasets: [
        {
          data: hasData ? deptList.map(d => d.count) : [0, 0, 0, 0, 0, 0, 0],
          backgroundColor: deptList.map(d => d.color),
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverOffset: 6,
        },
      ],
    };

    return {
      deptList,
      chartData,
      totalCount: totalCalculated,
      hasData,
    };
  }, [activeCadets]);

  const todayKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const todayAttendanceStats = useMemo(() => {
    const cadetList = activeCadets || [];
    const total = cadetList.length || 21;

    // Filter today's attendance logs
    const todayLogs = (propsLogs || []).filter(l => {
      const raw = l.date || l.sessionDate || l.session_date || l.timestamp || l.scanned_at || l.scannedAt || l.timeIn || l.time_in;
      if (!raw) return false;
      const str = String(raw).slice(0, 10);
      return str === todayKey;
    });

    let present = 0;
    let late = 0;
    let noTimeInOut = 0;
    let absent = 0;

    if (todayLogs.length > 0) {
      const { summary } = reconcileRosterAttendance(cadetList, todayLogs, todayKey);
      present = summary?.presentCompleteCount || 0;
      late = summary?.lateCompleteCount || 0;
      noTimeInOut = summary?.incompleteCount || 0;
      absent = Math.max(0, total - (present + late + noTimeInOut));
    } else {
      absent = total;
    }

    return {
      present,
      late,
      noTimeInOut,
      absent,
      total
    };
  }, [activeCadets, propsLogs, todayKey]);

  const donutChartData = useMemo(() => {
    const { present, late, noTimeInOut, absent, total } = todayAttendanceStats;
    const hasAnyScans = present > 0 || late > 0 || noTimeInOut > 0;

    const dataValues = hasAnyScans
      ? [present, late, noTimeInOut, absent]
      : [0, 0, 0, total];

    return {
      labels: ['Present', 'Late', 'No Time In/Out', 'Absent'],
      datasets: [
        {
          data: dataValues,
          backgroundColor: [
            '#10b981', // Present (Emerald)
            '#f59e0b', // Late (Amber)
            '#f97316', // No Time In/Out (Orange)
            '#ef4444'  // Absent (Red)
          ],
          hoverBackgroundColor: [
            '#059669',
            '#d97706',
            '#ea580c',
            '#dc2626'
          ],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }
      ]
    };
  }, [todayAttendanceStats]);

  const donutChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: {
        display: false
      },
      datalabels: {
        display: false
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleFont: { size: 12, weight: 'bold' },
        bodyFont: { size: 11 },
        padding: 8,
        cornerRadius: 6,
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const val = context.parsed || 0;
            const total = todayAttendanceStats.total || 1;
            const pct = Math.round((val / total) * 100);
            return ` ${label}: ${val} (${pct}%)`;
          }
        }
      }
    }
  }), [todayAttendanceStats]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header Banner: Analytics & Reports */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ color: 'var(--rotc-green-dark)', fontFamily: 'Oswald, sans-serif', fontSize: '1.5rem', margin: 0, letterSpacing: '0.5px' }}>
              ANALYTICS & REPORTS
            </h2>

          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Official CSU ROTC single-semester cadet demographics, gender distributions, geographic origins, and turnout trends.
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: TOP MUSTER & ENROLLMENT TRENDS ROW (3 EQUAL COLUMNS)           */}
      {/* 1. Cadet Growth (1 col) | 2. Attendance Trend (1 col) | 3. Today's Donut (1 col) */}
      {/* ========================================================================= */}
      <div 
        className="grid grid-cols-1 lg:grid-cols-3" 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
          gap: '1.5rem',
          alignItems: 'stretch'
        }}
      >

        {/* 1. Cadet Growth Timeline Curve */}
        <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '0.85rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={16} color="var(--rotc-green-dark)" />
              <h3 style={{ fontSize: '0.875rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>Cadet Growth</h3>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#0284c7', background: '#e0f2fe', padding: '2px 8px', borderRadius: '9999px' }}>
              Active Enrollment Timeline
            </span>
          </div>
          <div style={{ height: '175px', width: '100%', flex: 1 }}>
            <Line data={growthData} options={growthChartOptions} />
          </div>
        </div>

        {/* 2. Formation Attendance Turnout Trend */}
        <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '0.85rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={16} color="#0284c7" />
              <h3 style={{ fontSize: '0.875rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>Attendance Trend</h3>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#0284c7', background: '#e0f2fe', padding: '2px 8px', borderRadius: '9999px' }}>
              Formation %
            </span>
          </div>
          <div style={{ height: '175px', width: '100%', flex: 1 }}>
            <Line data={trendData} options={attendanceChartOptions} />
          </div>
        </div>

        {/* 3. Today's Attendance Breakdown Donut Chart */}
        <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '0.85rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <PieChart size={16} color="#059669" />
              <h3 style={{ fontSize: '0.875rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>Today's Attendance</h3>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#065f46', background: '#ecfdf5', padding: '2px 8px', borderRadius: '9999px', border: '1px solid #a7f3d0' }}>
              Live Formation
            </span>
          </div>

          <div style={{ position: 'relative', height: '135px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Doughnut data={donutChartData} options={donutChartOptions} />
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', lineHeight: 1, fontFamily: 'Inter, sans-serif' }}>
                {todayAttendanceStats.total}
              </span>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>
                Cadets
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.35rem 0.75rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#475569', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                Present
              </span>
              <span style={{ fontWeight: 800, color: '#10b981' }}>{todayAttendanceStats.present}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#475569', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                Late
              </span>
              <span style={{ fontWeight: 800, color: '#f59e0b' }}>{todayAttendanceStats.late}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#475569', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f97316' }} />
                No Time In/Out
              </span>
              <span style={{ fontWeight: 800, color: '#f97316' }}>{todayAttendanceStats.noTimeInOut}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#475569', fontWeight: 600 }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                Absent
              </span>
              <span style={{ fontWeight: 800, color: '#ef4444' }}>{todayAttendanceStats.absent}</span>
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: DEMOGRAPHICS ROW 1 (College & Gender | Geographic Origin)       */}
      {/* ========================================================================= */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5rem' }}>

        {/* 4. College Enrollment & Gender (Grouped / Stacked Bar Chart) */}
        <div style={{ gridColumn: 'span 7', backgroundColor: '#ffffff', padding: '1.35rem', borderRadius: '0.85rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <GraduationCap size={18} color="var(--rotc-green-dark)" />
                <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>
                  College Enrollment & Gender Distribution
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                {/* Total Cadets Pill */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    backgroundColor: '#f8fafc',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    padding: '2px 8px',
                    borderRadius: '6px'
                  }}
                >
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Total:</span>
                  <strong>{collegeGenderData.grandTotal} Cadets</strong>
                </span>

                {/* Male Cadets Pill */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    backgroundColor: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    padding: '2px 8px',
                    borderRadius: '6px'
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563eb', display: 'inline-block' }} />
                  <span>{collegeGenderData.totalMales} Male</span>
                  <span style={{ fontSize: '0.68rem', opacity: 0.85, fontWeight: 700 }}>
                    ({Math.round((collegeGenderData.totalMales / (collegeGenderData.grandTotal || 1)) * 100)}%)
                  </span>
                </span>

                {/* Female Cadets Pill */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    backgroundColor: '#fdf2f8',
                    color: '#be185d',
                    border: '1px solid #fbcfe8',
                    padding: '2px 8px',
                    borderRadius: '6px'
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ec4899', display: 'inline-block' }} />
                  <span>{collegeGenderData.totalFemales} Female</span>
                  <span style={{ fontSize: '0.68rem', opacity: 0.85, fontWeight: 700 }}>
                    ({Math.round((collegeGenderData.totalFemales / (collegeGenderData.grandTotal || 1)) * 100)}%)
                  </span>
                </span>
              </div>
            </div>

            {/* Toggle Grouped vs Stacked */}
            <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '2px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => setIsCollegeChartStacked(false)}
                style={{
                  padding: '3px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  borderRadius: '4px',
                  border: 'none',
                  background: !isCollegeChartStacked ? '#ffffff' : 'transparent',
                  color: !isCollegeChartStacked ? 'var(--rotc-green-dark)' : '#64748b',
                  boxShadow: !isCollegeChartStacked ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer'
                }}
              >
                Grouped
              </button>
              <button
                type="button"
                onClick={() => setIsCollegeChartStacked(true)}
                style={{
                  padding: '3px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  borderRadius: '4px',
                  border: 'none',
                  background: isCollegeChartStacked ? '#ffffff' : 'transparent',
                  color: isCollegeChartStacked ? 'var(--rotc-green-dark)' : '#64748b',
                  boxShadow: isCollegeChartStacked ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer'
                }}
              >
                Stacked
              </button>
            </div>
          </div>

          <div style={{ height: '260px', width: '100%' }}>
            <Bar data={collegeGenderData.chartData} options={createCollegeGenderOptions(isCollegeChartStacked)} />
          </div>
        </div>

        {/* 5. Geographic Origin (Horizontal Ranking Bar Chart) */}
        <div style={{ gridColumn: 'span 5', backgroundColor: '#ffffff', padding: '1.35rem', borderRadius: '0.85rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <MapPin size={18} color="var(--rotc-green-dark)" />
              <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>
                Geographic Origin (Provinces Ranking)
              </h3>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#065f46', background: '#ecfdf5', padding: '2px 8px', borderRadius: '9999px' }}>
              Top Regions
            </span>
          </div>

          <div style={{ height: '260px', width: '100%' }}>
            <Bar data={provinceData.chartData} options={provinceRankingOptions} />
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: DEMOGRAPHICS ROW 2 (Religion Summary | Department Breakdown)   */}
      {/* ========================================================================= */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5rem' }}>

        {/* 6. Demographics (Religion Summary Donut & Progress Bars) */}
        <div style={{ gridColumn: 'span 6', backgroundColor: '#ffffff', padding: '1.35rem', borderRadius: '0.85rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '1.25rem' }}>
            <HeartHandshake size={18} color="var(--rotc-green-dark)" />
            <div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>
                Demographics & Religious Affiliations
              </h3>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                Unit breakdown across faith communities ({religionData.total} Total Cadets)
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: '1.5rem', alignItems: 'center' }}>
            {/* Donut Chart */}
            <div style={{ position: 'relative', height: '170px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Doughnut data={religionData.chartData} options={religionDonutOptions} />
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#0f172a', lineHeight: 1 }}>
                  {religionData.total}
                </div>
                <div style={{ fontSize: '0.62rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginTop: '2px' }}>
                  Cadets
                </div>
              </div>
            </div>

            {/* Horizontal Progress Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {religionData.list.map((item) => {
                const pct = religionData.total > 0 ? Math.round((item.count / religionData.total) * 100) : 0;
                const isPendingOrOther = item.key === 'UNSPECIFIED' ||
                  item.key === 'OTHERS' ||
                  item.name.toLowerCase().includes('pending') ||
                  item.name.toLowerCase().includes('unspecified') ||
                  item.name.toLowerCase().includes('other');

                return (
                  <div key={item.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', marginBottom: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }}></span>
                        <strong style={{ color: isPendingOrOther ? '#64748b' : '#1e293b' }}>{item.name}</strong>
                      </div>
                      <span style={{ fontWeight: 800, color: isPendingOrOther ? '#64748b' : '#0f172a' }}>
                        {item.count} <span style={{ color: '#94a3b8', fontWeight: 600 }}>({pct}%)</span>
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '5px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: item.color, borderRadius: '3px', transition: 'width 0.5s ease' }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 7. Department / Academic Strength Distribution */}
        <div style={{ gridColumn: 'span 6', backgroundColor: '#ffffff', padding: '1.35rem', borderRadius: '0.85rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '1.25rem' }}>
            <Building size={18} color="var(--rotc-green-dark)" />
            <div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>
                Academic College Distribution
              </h3>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                Total Strength: {departmentDistribution.totalCount} Enrolled Cadets
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: '1.5rem', alignItems: 'center' }}>
            {/* Donut Chart */}
            <div style={{ position: 'relative', height: '170px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Doughnut data={departmentDistribution.chartData} options={departmentDonutOptions} />
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#0f172a', lineHeight: 1 }}>
                  {departmentDistribution.totalCount}
                </div>
                <div style={{ fontSize: '0.62rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginTop: '2px' }}>
                  Total
                </div>
              </div>
            </div>

            {/* Department Breakdown Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', maxHeight: '180px', overflowY: 'auto' }}>
              {departmentDistribution.deptList.map(dept => {
                const pct = departmentDistribution.totalCount > 0
                  ? Math.round((dept.count / departmentDistribution.totalCount) * 100)
                  : 0;

                return (
                  <div
                    key={dept.key}
                    style={{
                      backgroundColor: '#f8fafc',
                      padding: '0.4rem 0.6rem',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: dept.color
                        }}></span>
                        <strong style={{ fontSize: '0.74rem', color: '#1e293b' }}>
                          {dept.key}
                        </strong>
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#0f172a' }}>
                        {dept.count} <span style={{ fontSize: '0.65rem', color: '#64748b' }}>({pct}%)</span>
                      </span>
                    </div>

                    <div style={{ width: '100%', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        backgroundColor: dept.color,
                        borderRadius: '2px',
                        transition: 'width 0.5s ease-out'
                      }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* SECTION 4: CADET ATTENDANCE PERFORMANCE & DROP TRACKER                    */}
      {/* ========================================================================= */}
      <section
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          border: '1px solid #e2e8f0',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}
      >
        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: '#fff1f2',
              border: '1px solid #fecdd3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#e11d48'
            }}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                Cadet Attendance Performance & Drop Alerts
              </h3>
              <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '2px 0 0 0' }}>
                Automated monitoring for dropped cadets and threshold warnings.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>

            <span style={{
              fontSize: '0.74rem',
              fontWeight: 800,
              backgroundColor: sortedFlaggedCadets.length > 0 ? '#ffe4e6' : '#ecfdf5',
              color: sortedFlaggedCadets.length > 0 ? '#9f1239' : '#065f46',
              border: `1px solid ${sortedFlaggedCadets.length > 0 ? '#fecdd3' : '#a7f3d0'}`,
              padding: '4px 12px',
              borderRadius: '9999px'
            }}>
              {sortedFlaggedCadets.length} Action Required
            </span>
          </div>
        </div>

        {/* CADETS TABLE SCROLL CONTAINER (MAX 10 ROWS VISIBLE WITH STICKY HEADER) */}
        <div style={{
          maxHeight: '480px',
          overflowY: 'auto',
          overflowX: 'auto',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          backgroundColor: '#ffffff',
          position: 'relative',
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e1 #f8fafc'
        }}>
          <table style={{ width: '100%', textAlign: 'left', fontSize: '0.78rem', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ backgroundColor: '#f8fafc', color: '#475569', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.03em' }}>
                <th style={{ padding: '0.75rem 1rem', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>Cadet ID & Name</th>
                <th style={{ padding: '0.75rem 1rem', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>Platoon Unit</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>Contact Number</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>Calculated Absences</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>Rule Evaluation</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>Status Badge</th>
              </tr>
            </thead>
            <tbody>
              {sortedFlaggedCadets.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#94a3b8', fontWeight: 500 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={24} color="#10b981" />
                      <span>No attendance warnings or drops recorded. All active cadets are in good standing.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedFlaggedCadets.map((cadet) => (
                  <tr key={cadet.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s ease' }}>
                    <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{cadet.name}</div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', fontFamily: 'monospace' }}>{cadet.id}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#475569', borderBottom: '1px solid #f1f5f9' }}>
                      {cadet.battalion} • {cadet.company} • {cadet.platoon}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                      {cadet.contact_number || cadet.contactNumber || cadet.phone ? (
                        <a
                          href={`tel:${cadet.contact_number || cadet.contactNumber || cadet.phone}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            color: '#047857',
                            textDecoration: 'none',
                            fontWeight: 700,
                            fontSize: '0.74rem'
                          }}
                        >
                          <Phone size={12} />
                          <span>{cadet.contact_number || cadet.contactNumber || cadet.phone}</span>
                        </a>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 800, color: '#1e293b', fontSize: '0.85rem', borderBottom: '1px solid #f1f5f9' }}>
                      {cadet.totalAbsences}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                      <button
                        type="button"
                        onClick={() => setEvidenceCadet(cadet)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          color: '#0369a1',
                          backgroundColor: '#f0f9ff',
                          border: '1px solid #bae6fd',
                          padding: '4px 9px',
                          borderRadius: '6px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textAlign: 'center',
                          fontSize: '0.74rem',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#e0f2fe';
                          e.currentTarget.style.borderColor = '#7dd3fc';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#f0f9ff';
                          e.currentTarget.style.borderColor = '#bae6fd';
                        }}
                        title="Click to inspect full attendance breakdown & evidence logs"
                      >
                        <span>{cadet.reason}</span>
                        <Eye size={13} />
                      </button>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                      {cadet.status === 'DROPPED' ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          backgroundColor: '#e11d48',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '0.68rem',
                          textTransform: 'uppercase',
                          boxShadow: '0 1px 3px rgba(225, 29, 72, 0.3)'
                        }}>
                          <AlertOctagon size={12} /> DROPPED
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          backgroundColor: '#f59e0b',
                          color: '#0f172a',
                          fontWeight: 800,
                          fontSize: '0.68rem',
                          textTransform: 'uppercase',
                          boxShadow: '0 1px 3px rgba(245, 158, 11, 0.3)'
                        }}>
                          <AlertTriangle size={12} /> WARNING
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* POLICY REFERENCE FOOTER NOTE - STRUCTURED GRID CARD FORMAT */}
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem'
        }}>
          {/* Section Title Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#047857'
              }}>
                <Info size={15} />
              </div>
              <span style={{ fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.78rem' }}>
                Attendance Performance Policy Rules Reference
              </span>
            </div>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>
              Official ROTC Training Manual Guidelines
            </span>
          </div>

          {/* 3-Column Policy Grid Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '0.75rem'
          }}>
            {/* Card 1: Official Drop Policy (Crimson) */}
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #fecdd3',
              borderRadius: '10px',
              padding: '0.85rem 1rem',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: '#9f1239',
                  backgroundColor: '#ffe4e6',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  textTransform: 'uppercase'
                }}>
                  <AlertOctagon size={11} /> Official Drop (Discharge)
                </span>
                <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>Rule 1 & 2</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.74rem', color: '#334155', lineHeight: '1.5' }}>
                <li><strong>3 Consecutive Absences:</strong> Triggers immediate official drop status.</li>
                <li><strong>&gt; 3 Interval Absences:</strong> More than 3 total accumulated unexcused absences results in drop.</li>
              </ul>
            </div>

            {/* Card 2: Warning Threshold Policy (Amber) */}
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #fde68a',
              borderRadius: '10px',
              padding: '0.85rem 1rem',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: '#92400e',
                  backgroundColor: '#fef3c7',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  textTransform: 'uppercase'
                }}>
                  <AlertTriangle size={11} /> Warning Threshold
                </span>
                <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>Rule 3 & 4</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.74rem', color: '#334155', lineHeight: '1.5' }}>
                <li><strong>3 Interval Absences:</strong> First official warning issued for impending drop.</li>
                <li><strong>2 Absences:</strong> Early notification advisory for unit commander intervention.</li>
              </ul>
            </div>

            {/* Card 3: Tardiness & Missing Scans Conversions (Emerald / Teal) */}
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              padding: '0.85rem 1rem',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: '#0f766e',
                  backgroundColor: '#ccfbf1',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  textTransform: 'uppercase'
                }}>
                  <Clock size={11} /> Tardiness & Missing Scans
                </span>
                <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>Rule 5, 6 & 7</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.74rem', color: '#334155', lineHeight: '1.5' }}>
                <li><strong>3 Consecutive Lates:</strong> Automatically penalized and converted to <strong>1 Absent</strong>.</li>
                <li><strong>4 Interval Lates:</strong> Every 4 cumulative late scans converts to <strong>1 Absent</strong>.</li>
                <li><strong>4 Interval No Time-In/Out:</strong> Every 4 missing scans converts to <strong>1 Absent</strong>.</li>
              </ul>
            </div>
          </div>
        </div>

      </section>

      {/* ========================================================================= */}
      {/* ATTENDANCE BREAKDOWN & EVIDENCE MODAL                                     */}
      {/* ========================================================================= */}
      {evidenceCadet && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={() => setEvidenceCadet(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '820px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              padding: '1.5rem'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* MODAL HEADER */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: evidenceCadet.status === 'DROPPED' ? '#fff1f2' : '#fef3c7',
                  border: `1px solid ${evidenceCadet.status === 'DROPPED' ? '#fecdd3' : '#fde68a'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: evidenceCadet.status === 'DROPPED' ? '#e11d48' : '#d97706'
                }}>
                  {evidenceCadet.status === 'DROPPED' ? <AlertOctagon size={24} /> : <AlertTriangle size={24} />}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      {evidenceCadet.name}
                    </h2>
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      backgroundColor: '#f1f5f9',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      color: '#475569'
                    }}>
                      {evidenceCadet.id}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span><strong>Unit:</strong> {evidenceCadet.battalion} • {evidenceCadet.company} • {evidenceCadet.platoon}</span>
                    {evidenceCadet.contact_number && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#047857', fontWeight: 600 }}>
                        <Phone size={12} /> {evidenceCadet.contact_number}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEvidenceCadet(null)}
                style={{
                  backgroundColor: '#f1f5f9',
                  border: 'none',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* SUMMARY METRICS BAR - STANDARDIZED GRID & ALIGNMENT */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
              gap: '0.65rem'
            }}>
              {/* Card 1: Total Absences */}
              <div style={{
                backgroundColor: '#fff1f2',
                border: '1px solid #fecdd3',
                borderRadius: '12px',
                padding: '0.75rem 0.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '82px',
                textAlign: 'center'
              }}>
                <div style={{
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: '#9f1239',
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                  lineHeight: 1.15
                }}>
                  Total Absences
                </div>
                <div style={{
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.35rem',
                  fontWeight: 900,
                  color: '#e11d48',
                  lineHeight: 1
                }}>
                  {evidenceCadet.totalAbsences}
                </div>
              </div>

              {/* Card 2: Consecutive Absences */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '0.75rem 0.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '82px',
                textAlign: 'center'
              }}>
                <div style={{
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                  lineHeight: 1.15
                }}>
                  Consecutive Absences
                </div>
                <div style={{
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.35rem',
                  fontWeight: 900,
                  color: '#0f172a',
                  lineHeight: 1
                }}>
                  {evidenceCadet.maxConsecutiveAbsences}
                </div>
              </div>

              {/* Card 3: Total Lates */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '0.75rem 0.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '82px',
                textAlign: 'center'
              }}>
                <div style={{
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                  lineHeight: 1.15
                }}>
                  Total Lates
                </div>
                <div style={{
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  lineHeight: 1
                }}>
                  <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a' }}>
                    {evidenceCadet.totalIntervalLates || 0}
                  </span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>
                    (+{evidenceCadet.lateConversions || 0} Abs)
                  </span>
                </div>
              </div>

              {/* Card 4: Missing Scans */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '0.75rem 0.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '82px',
                textAlign: 'center'
              }}>
                <div style={{
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                  lineHeight: 1.15
                }}>
                  Missing Scans
                </div>
                <div style={{
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  lineHeight: 1
                }}>
                  <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a' }}>
                    {evidenceCadet.totalIntervalMissingScans || 0}
                  </span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>
                    (+{evidenceCadet.missingScanConversions || 0} Abs)
                  </span>
                </div>
              </div>

              {/* Card 5: Rule Status */}
              <div style={{
                backgroundColor: evidenceCadet.status === 'DROPPED' ? '#ffe4e6' : '#fef3c7',
                border: `1px solid ${evidenceCadet.status === 'DROPPED' ? '#fecdd3' : '#fde68a'}`,
                borderRadius: '12px',
                padding: '0.75rem 0.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '82px',
                textAlign: 'center'
              }}>
                <div style={{
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: evidenceCadet.status === 'DROPPED' ? '#9f1239' : '#92400e',
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                  lineHeight: 1.15
                }}>
                  Rule Status
                </div>
                <div style={{
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.85rem',
                  fontWeight: 900,
                  color: evidenceCadet.status === 'DROPPED' ? '#e11d48' : '#d97706',
                  textTransform: 'uppercase',
                  lineHeight: 1
                }}>
                  {evidenceCadet.status}
                </div>
              </div>
            </div>

            {/* CHRONOLOGICAL EVIDENCE LOG TABLE */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.6rem' }}>
                <FileText size={16} color="#0284c7" />
                <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.03em', margin: 0 }}>
                  Active Formation Schedule Evidence Breakdown
                </h4>
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                <table style={{ width: '100%', textAlign: 'left', fontSize: '0.76rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Formation Date</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Scan Record</th>
                      <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Day State</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Policy Impact & Penalty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(evidenceCadet.dailyBreakdown || []).map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: row.dayType === 'ABSENT' || row.dayType === 'UNRECORDED' ? '#fffbfa' : '#ffffff' }}>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                          {row.date}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#475569', fontSize: '0.72rem' }}>
                          {row.timeIn || row.timeOut ? (
                            <div>
                              {row.timeIn && <div><strong>Time-In:</strong> {new Date(row.timeIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || row.timeIn}</div>}
                              {row.timeOut && <div><strong>Time-Out:</strong> {new Date(row.timeOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || row.timeOut}</div>}
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No scan recorded</span>
                          )}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontWeight: 800,
                            fontSize: '0.65rem',
                            textTransform: 'uppercase',
                            backgroundColor:
                              row.dayType === 'PRESENT' ? '#ecfdf5' :
                                row.dayType === 'LATE' ? '#fef3c7' :
                                  row.dayType === 'EXCUSED' ? '#f0fdf4' : '#ffe4e6',
                            color:
                              row.dayType === 'PRESENT' ? '#065f46' :
                                row.dayType === 'LATE' ? '#92400e' :
                                  row.dayType === 'EXCUSED' ? '#15803d' : '#9f1239'
                          }}>
                            {row.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#334155' }}>
                          {row.penaltyLabel}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export { AnalyticsView as AnalyticsReportsView, AnalyticsView as AnalyticsAndReportsView };
