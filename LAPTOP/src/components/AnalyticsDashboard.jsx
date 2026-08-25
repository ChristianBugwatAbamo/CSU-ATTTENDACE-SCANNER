import React, { useState, useEffect, useMemo } from 'react';
import { Users, UserCheck, Shield, Award, Activity, RefreshCw, Layers, Compass, Building, CheckCircle2, Filter, XCircle, ChevronRight, ChevronLeft, ArrowLeft, RotateCcw, Star, Medal, Clock, Search, X, Archive, Calendar, History, UserX, PieChart } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Line, Doughnut } from 'react-chartjs-2';
import AttendanceHistory from './AttendanceHistory';
import DashboardUnitHierarchy from './DashboardUnitHierarchy';

// Register Chart.js components + DataLabels plugin
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Filler,
  Legend,
  ChartDataLabels
);

// --- Options for Attendance Trend (Percentages) ---
const attendanceChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    datalabels: {
      display: true,
      align: 'top',
      anchor: 'end',
      color: '#1e293b',
      font: { weight: 'bold', size: 11 },
      formatter: (value) => `${value}%`, // Adds % above points (e.g., 58%, 100%)
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
        callback: (value) => `${value}%`, // Y-axis shows 0%, 20%, 40%... 100%
      },
    },
  },
};

// --- Options for Cadet Growth (Raw Totals) ---
const growthChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    datalabels: {
      display: true,
      align: 'top',
      anchor: 'end',
      color: '#1e293b',
      font: { weight: 'bold', size: 11 },
      formatter: (value) => `${value}`, // Raw count above point (e.g., 12)
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

// --- Options for Department Distribution Donut Chart ---
const departmentDonutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '68%',
  plugins: {
    legend: {
      display: false,
    },
    datalabels: {
      display: (context) => {
        const val = context.dataset.data[context.dataIndex];
        return val > 0;
      },
      color: '#ffffff',
      font: { weight: 'bold', size: 10 },
      formatter: (value, ctx) => {
        const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
        return pct >= 6 ? `${pct}%` : '';
      },
      textShadowColor: 'rgba(0, 0, 0, 0.45)',
      textShadowBlur: 4,
    },
    tooltip: {
      backgroundColor: '#0f172a',
      titleFont: { size: 12, weight: 'bold' },
      bodyFont: { size: 11 },
      padding: 10,
      cornerRadius: 8,
      callbacks: {
        label: (context) => {
          const label = context.label || '';
          const value = context.parsed || 0;
          const total = context.dataset.data.reduce((a, b) => a + b, 0);
          const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
          return ` ${label}: ${value} Cadets (${pct}%)`;
        },
      },
    },
  },
};
import {
  getAttendanceStatus,
  getScannedUnitEchelon,
  evaluateSingleScan,
  reconcileCadetDailyStatus,
  reconcileRosterAttendance,
  getActiveFormationCutoff,
  normalizeBattalion,
  normalizeCompany,
  normalizePlatoon
} from '../utils/attendanceStatus';
import { useAttendanceData } from '../hooks/useAttendanceData';
import { subscribeToAttendanceRealtime, fetchCadetCountFromSupabase, getSupabaseClient } from '../utils/supabaseClient';

// Standalone Hook to fetch attendance trend counting both Present & Late cadets
export function useAttendanceTrendData() {
  const [trendData, setTrendData] = useState({ labels: [], datasets: [] });

  useEffect(() => {
    async function fetchTurnoutTrend() {
      const client = getSupabaseClient() || supabase;
      if (!client) return;

      // 1. Fetch total enrolled cadets for capacity baseline
      const { count: totalCadets } = await client
        .from('cadets')
        .select('*', { count: 'exact', head: true });

      const unitCapacity = totalCadets || 12;

      // 2. Query attendance logs for Present or Late statuses grouped by date
      const { data: logs, error } = await client
        .from('attendance_logs')
        .select('created_at, date, timestamp, status')
        .in('status', ['PRESENT', 'LATE', 'Present', 'Late']); // Counts both Present & Late

      if (error || !logs) return;

      // 3. Aggregate count by unique date string (e.g., "Aug 22")
      const dailyAttended = logs.reduce((acc, curr) => {
        const rawDate = curr.created_at || curr.date || curr.timestamp;
        const d = rawDate ? new Date(rawDate) : new Date();
        const dateKey = !isNaN(d.getTime())
          ? d.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })
          : (curr.date || 'Today');
        acc[dateKey] = (acc[dateKey] || 0) + 1;
        return acc;
      }, {});

      // 4. Calculate percentage rates per date
      const labels = Object.keys(dailyAttended);
      const percentageRates = Object.values(dailyAttended).map((attendedCount) => {
        const rate = Math.round((attendedCount / unitCapacity) * 100);
        return rate > 100 ? 100 : rate;
      });

      setTrendData({
        labels,
        datasets: [
          {
            fill: true,
            label: 'Muster Attendance Rate %',
            data: percentageRates,
            borderColor: '#0284c7',
            backgroundColor: 'rgba(2, 132, 199, 0.15)',
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#0284c7',
          },
        ],
      });
    }

    fetchTurnoutTrend();
  }, []);

  return trendData;
}

// Dynamic Hook to aggregate daily attendance & fetch real cadet registration growth
export function useDashboardAnalyticsData(rawLogs = [], totalCapacity = 12) {
  const [growthData, setGrowthData] = useState({
    labels: ['Aug 2026'],
    datasets: [{
      fill: true,
      label: 'Total Cadets Registered',
      data: [totalCapacity || 12],
      borderColor: '#0284c7',
      backgroundColor: 'rgba(2, 132, 199, 0.15)',
      tension: 0.3,
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
        const client = getSupabaseClient() || supabase;

        // --- 1. Cadet Growth (Real Database Count / Timestamps) ---
        let totalCount = totalCapacity || 12;
        let monthlyGrowthMap = new Map();

        if (client) {
          const { count: exactCadetCount } = await client
            .from('cadets')
            .select('*', { count: 'exact', head: true });

          if (typeof exactCadetCount === 'number' && exactCadetCount > 0) {
            totalCount = exactCadetCount;
          }

          const { data: cadets } = await client
            .from('cadets')
            .select('created_at');

          if (cadets && cadets.length > 0) {
            if (!exactCadetCount) totalCount = cadets.length;
            // Group cadets by month created
            cadets.forEach(c => {
              const d = c.created_at ? new Date(c.created_at) : new Date();
              const monthLabel = isNaN(d.getTime())
                ? 'Aug 2026'
                : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
              monthlyGrowthMap.set(monthLabel, (monthlyGrowthMap.get(monthLabel) || 0) + 1);
            });
          }
        }

        if (isMounted) {
          const growthLabels = monthlyGrowthMap.size > 0
            ? Array.from(monthlyGrowthMap.keys())
            : ['Aug 2026'];

          let runningTotal = 0;
          const growthCounts = monthlyGrowthMap.size > 0
            ? Array.from(monthlyGrowthMap.values()).map(count => {
                runningTotal += count;
                return runningTotal;
              })
            : [totalCount];

          setGrowthData({
            labels: growthLabels,
            datasets: [{
              fill: true,
              label: 'Total Cadets Registered',
              data: growthCounts,
              borderColor: '#0284c7',
              backgroundColor: 'rgba(2, 132, 199, 0.15)',
              tension: 0.3,
              pointRadius: 4,
              pointBackgroundColor: '#0284c7',
            }]
          });
        }

        // --- 2. Attendance Trend (Aggregated by Date, Counting Both Present & Late) ---
        let dailyTotals = {};

        if (client) {
          // Query attendance logs for Present or Late statuses
          const { data: logs, error: logsError } = await client
            .from('attendance_logs')
            .select('created_at, date, timestamp, status')
            .in('status', ['PRESENT', 'LATE', 'Present', 'Late']);

          if (!logsError && Array.isArray(logs) && logs.length > 0) {
            dailyTotals = logs.reduce((acc, curr) => {
              const rawDate = curr.created_at || curr.date || curr.timestamp;
              const d = rawDate ? new Date(rawDate) : new Date();
              const dateKey = !isNaN(d.getTime())
                ? d.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                : (curr.date || 'Today');
              acc[dateKey] = (acc[dateKey] || 0) + 1;
              return acc;
            }, {});
          } else {
            // Fallback to attendance_sessions (summing present_count + late_count)
            const { data: sessions } = await client
              .from('attendance_sessions')
              .select('session_date, total_scanned, present_count, late_count')
              .order('session_date', { ascending: true });

            if (sessions && sessions.length > 0) {
              dailyTotals = sessions.reduce((acc, curr) => {
                const d = new Date(curr.session_date);
                const dateStr = isNaN(d.getTime())
                  ? String(curr.session_date)
                  : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                const scanned = (curr.present_count !== undefined || curr.late_count !== undefined)
                  ? ((curr.present_count || 0) + (curr.late_count || 0))
                  : ((curr.total_scanned !== undefined && curr.total_scanned !== null) ? curr.total_scanned : 0);

                acc[dateStr] = (acc[dateStr] || 0) + (scanned || 0);
                return acc;
              }, {});
            }
          }
        }

        // Fallback / supplement with raw attendance_logs if sessions/logs empty
        if (Object.keys(dailyTotals).length === 0 && Array.isArray(rawLogs) && rawLogs.length > 0) {
          const logsByDate = new Map();
          rawLogs.forEach(l => {
            const rawStatus = String(l.status || l.timeInStatus || l.finalDailyStatus || '').toUpperCase();
            // Count both PRESENT and LATE scans
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

          const sortedDates = Array.from(logsByDate.keys()).sort();
          sortedDates.forEach(dateKey => {
            const [y, m, d] = dateKey.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            const dateStr = isNaN(dateObj.getTime())
              ? dateKey
              : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            dailyTotals[dateStr] = logsByDate.get(dateKey).size;
          });
        }

        const unitCapacity = totalCount > 0 ? totalCount : (totalCapacity || 12);
        const labels = Object.keys(dailyTotals);
        const percentageRates = Object.values(dailyTotals).map((attendedCount) => {
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
        console.error('Error in useDashboardAnalyticsData:', err);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [rawLogs, totalCapacity]);

  return { growthData, trendData };
}

function toDateKey(dateInput) {
  if (!dateInput) return '';
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
    return dateInput.slice(0, 10);
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Default 1,184 Standard CSU ROTC Structure Template
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

export default function AnalyticsDashboard({ cadets: propsCadets = [], attendanceLogs: propsLogs = [], onRefresh, onNavigateToHistory }) {
  const { records: hookLogs = [], settings: hookSettings, activeCutoff, refreshFromStorage } = useAttendanceData();
  const rawMasterLogs = hookLogs && hookLogs.length > 0 ? hookLogs : propsLogs;

  const todayKey = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const formatHumanDate = (dateKey) => {
    if (!dateKey) return 'Today';
    const [y, m, d] = dateKey.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (isNaN(dateObj.getTime())) return dateKey;
    return dateObj.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Realtime subscription for instant dashboard re-trigger
  useEffect(() => {
    const channel = subscribeToAttendanceRealtime(() => {
      if (refreshFromStorage) refreshFromStorage();
      if (onRefresh) onRefresh();
    });

    const handleLocalUpdate = () => {
      if (refreshFromStorage) refreshFromStorage();
    };

    window.addEventListener('local-attendance-update', handleLocalUpdate);
    window.addEventListener('storage', handleLocalUpdate);

    return () => {
      if (channel) channel.unsubscribe();
      window.removeEventListener('local-attendance-update', handleLocalUpdate);
      window.removeEventListener('storage', handleLocalUpdate);
    };
  }, [refreshFromStorage, onRefresh]);

  // Strict Date Filter: Command dashboard strictly observes today's session_date (universal parser)
  const attendanceLogs = useMemo(() => {
    if (!Array.isArray(rawMasterLogs)) return [];
    return rawMasterLogs.filter(log => {
      const rawDate = log.date || log.timestamp || log.receivedAt;
      if (!rawDate) return false;
      const key = toDateKey(rawDate);
      return key === todayKey;
    });
  }, [rawMasterLogs, todayKey]);

  const hasTodayScans = attendanceLogs.length > 0;
  const formationCutoff = activeCutoff || getActiveFormationCutoff();
  const unitStructure = hookSettings?.unitStructure?.length > 0 ? hookSettings.unitStructure : DEFAULT_UNIT_STRUCTURE;

  // Cascading Selection State for drill-downs
  const [selectedBattalion, setSelectedBattalion] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedPlatoon, setSelectedPlatoon] = useState(null);

  // Search input state for filtering by Cadet ID or Name
  const [searchQuery, setSearchQuery] = useState('');

  // Status filter applied by clicking stat summary cards ('PRESENT' | 'LATE' | 'NO TIME-OUT' | 'ABSENT' | null)
  const [statusFilter, setStatusFilter] = useState(null);

  const handleStatusCardClick = (status) => {
    setStatusFilter(prev => prev === status ? null : status);
  };

  // 1. Dynamic Hierarchical Structure & Auto-Expanding Total Strength
  // Total Strength = Sum(Battalions) -> Sum(Companies) -> Sum(Platoons)
  const dynamicHierarchy = useMemo(() => {
    // Aggregate unique cadets from baseline roster + live/historical scans
    const allCadetsMap = new Map();
    (propsCadets || []).forEach(c => {
      const cid = String(c.id || c.cadetId || '').trim().toUpperCase();
      if (cid) allCadetsMap.set(cid, c);
    });
    (rawMasterLogs || []).forEach(l => {
      const cid = String(l.cadetId || l.id || '').trim().toUpperCase();
      if (cid && !allCadetsMap.has(cid)) {
        allCadetsMap.set(cid, {
          id: cid,
          cadetId: cid,
          name: l.name || `Cadet ${cid}`,
          rank: l.rank || 'Cadet',
          battalion: l.battalion || '1st Battalion',
          company: l.company || 'Alpha Company',
          platoon: l.platoon || '1st Platoon'
        });
      }
    });

    const allCadetsList = Array.from(allCadetsMap.values());

    // Build dynamic Battalions -> Companies -> Platoons
    const battalions = unitStructure.map((bn, bnIdx) => {
      const bnNorm = normalizeBattalion(bn.name);
      const bnCadets = allCadetsList.filter(c => {
        const cBnNorm = normalizeBattalion(c.battalion);
        return bnNorm && cBnNorm ? (bnNorm === cBnNorm) : false;
      });

      const companies = (bn.companies || []).map((co) => {
        const coNorm = normalizeCompany(co.name);
        const coCadets = bnCadets.filter(c => {
          const cCoNorm = normalizeCompany(c.company);
          return coNorm && cCoNorm ? (coNorm === cCoNorm) : false;
        });

        const platoons = (co.platoons || []).map((pl) => {
          const plNorm = normalizePlatoon(pl.name);
          const plCadets = coCadets.filter(c => {
            const cPlNorm = normalizePlatoon(c.platoon);
            return plNorm && cPlNorm ? (plNorm === cPlNorm) : false;
          });

          // Platoon Strength is dynamically calculated from actual registered/scanned cadets in this platoon
          const dynamicPlatoonStrength = plCadets.length;

          return {
            ...pl,
            registeredCount: plCadets.length,
            targetQuota: dynamicPlatoonStrength
          };
        });

        // Company Strength = Sum of its Platoons
        const dynamicCompanyStrength = platoons.reduce((acc, p) => acc + p.targetQuota, 0);

        return {
          ...co,
          platoons,
          registeredCount: coCadets.length,
          targetQuota: dynamicCompanyStrength
        };
      });

      // Battalion Strength = Sum of its Companies
      const dynamicBattalionStrength = companies.reduce((acc, c) => acc + c.targetQuota, 0);

      return {
        ...bn,
        companies,
        registeredCount: bnCadets.length,
        targetQuota: dynamicBattalionStrength
      };
    });

    const totalUnitStrength = allCadetsList.length;

    return {
      allCadetsList,
      battalions,
      totalUnitStrength
    };
  }, [propsCadets, rawMasterLogs, unitStructure]);

  const [supabaseCadetCount, setSupabaseCadetCount] = useState(null);

  // Fetch real-time Total Cadets from Supabase
  useEffect(() => {
    let isMounted = true;
    const fetchUnitStrength = async () => {
      try {
        const count = await fetchCadetCountFromSupabase();
        if (isMounted && typeof count === 'number' && count >= 0) {
          setSupabaseCadetCount(count);
        }
      } catch (err) {
        console.error('Error fetching cadet count:', err);
      }
    };

    fetchUnitStrength();

    return () => {
      isMounted = false;
    };
  }, [propsCadets, rawMasterLogs]);

  // Dynamic Total Unit Strength: prefer real-time Supabase count, falling back to local roster aggregate
  const totalStrength = typeof supabaseCadetCount === 'number' && supabaseCadetCount > 0
    ? supabaseCadetCount
    : dynamicHierarchy.totalUnitStrength;

  // Dynamic Supabase & Historical Analytics Data (Cadet Growth & Unique Daily Attendance Trend)
  const { growthData: dynamicGrowthData, trendData: dynamicTrendData } = useDashboardAnalyticsData(rawMasterLogs, totalStrength);

  // Department Distribution (Official CSU Palette)
  const departmentDistribution = useMemo(() => {
    const cadetList = (dynamicHierarchy.allCadetsList && dynamicHierarchy.allCadetsList.length > 0)
      ? dynamicHierarchy.allCadetsList
      : (propsCadets || []);

    const counts = {
      CAA: 0,
      CCIS: 0,
      CED: 0,
      CEGS: 0,
      CHASS: 0,
      CMNS: 0,
      COFES: 0,
    };

    let unassignedCount = 0;

    cadetList.forEach(cadet => {
      const deptRaw = String(cadet.department || '').trim().toUpperCase();
      if (counts.hasOwnProperty(deptRaw)) {
        counts[deptRaw] += 1;
      } else if (deptRaw) {
        if (deptRaw.includes('AGRI') || deptRaw.includes('CAA')) counts.CAA += 1;
        else if (deptRaw.includes('COMPUT') || deptRaw.includes('CCIS') || deptRaw.includes('IT') || deptRaw.includes('CS')) counts.CCIS += 1;
        else if (deptRaw.includes('EDUC') || deptRaw.includes('CED')) counts.CED += 1;
        else if (deptRaw.includes('ENGIN') || deptRaw.includes('CEGS')) counts.CEGS += 1;
        else if (deptRaw.includes('HUMAN') || deptRaw.includes('CHASS') || deptRaw.includes('ARTS')) counts.CHASS += 1;
        else if (deptRaw.includes('MATH') || deptRaw.includes('NATURAL') || deptRaw.includes('CMNS') || deptRaw.includes('SCIENCE')) counts.CMNS += 1;
        else if (deptRaw.includes('FOREST') || deptRaw.includes('COFES')) counts.COFES += 1;
        else unassignedCount += 1;
      } else {
        unassignedCount += 1;
      }
    });

    const totalCalculated = Object.values(counts).reduce((a, b) => a + b, 0) + unassignedCount;

    const deptList = [
      { key: 'CAA', name: 'College of Agriculture & Agri-Industries', color: '#EAB308', count: counts.CAA },
      { key: 'CCIS', name: 'College of Computing & Information Sciences', color: '#F97316', count: counts.CCIS },
      { key: 'CED', name: 'College of Education', color: '#3B82F6', count: counts.CED },
      { key: 'CEGS', name: 'College of Engineering & Geosciences', color: '#881337', count: counts.CEGS },
      { key: 'CHASS', name: 'College of Humanities & Social Sciences', color: '#8B5CF6', count: counts.CHASS },
      { key: 'CMNS', name: 'College of Mathematics & Natural Sciences', color: '#EF4444', count: counts.CMNS },
      { key: 'COFES', name: 'College of Forestry & Environmental Science', color: '#10B981', count: counts.COFES },
    ];

    if (unassignedCount > 0) {
      deptList.push({ key: 'OTHER', name: 'Unassigned / Other', color: '#94A3B8', count: unassignedCount });
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
  }, [dynamicHierarchy.allCadetsList, propsCadets]);

  const totalUnitStrengthQuota = totalStrength;

  // Expected Target Capacity from Unit Configuration Settings
  const totalConfiguredCapacity = unitStructure.reduce((acc, bn) => acc + (Number(bn.targetQuota) || 0), 0) || totalStrength;

  const totalPlatoonsCount = dynamicHierarchy.battalions.reduce((acc, bn) => {
    return acc + (bn.companies ? bn.companies.reduce((pAcc, co) => pAcc + (co.platoons ? co.platoons.length : 0), 0) : 0);
  }, 0);

  // 2. Dynamic Counts calculated directly from today's attendanceLogs
  const { reconciledRoster: rawReconciledRoster, summary: rawSummary } = useMemo(() => {
    return reconcileRosterAttendance(
      dynamicHierarchy.allCadetsList,
      attendanceLogs,
      null,
      formationCutoff
    );
  }, [dynamicHierarchy.allCadetsList, attendanceLogs, formationCutoff]);

  const attendanceSummary = useMemo(() => {
    if (!hasTodayScans) {
      return {
        totalStrength: dynamicHierarchy.totalUnitStrength,
        presentCompleteCount: 0,
        lateCompleteCount: 0,
        incompleteCount: 0,
        absentCount: 0,
        totalScanned: 0,
        presentOrLateCount: 0
      };
    }
    return rawSummary;
  }, [hasTodayScans, rawSummary, dynamicHierarchy.totalUnitStrength]);

  const reconciledRoster = useMemo(() => {
    if (!hasTodayScans) {
      return dynamicHierarchy.allCadetsList.map(cadet => ({
        ...cadet,
        cadetId: cadet.id || cadet.cadetId,
        hasTimeIn: false,
        hasTimeOut: false,
        timeInDisplay: null,
        timeOutDisplay: null,
        timeInStatus: null,
        timeOutStatus: null,
        status: 'NO SCAN TODAY',
        finalDailyStatus: 'NO SCAN TODAY'
      }));
    }
    return rawReconciledRoster;
  }, [hasTodayScans, rawReconciledRoster, dynamicHierarchy.allCadetsList]);

  const totalAttendanceScans = attendanceLogs.length;
  const uniqueCadetIds = new Set(attendanceLogs.map(l => (l.cadetId || '').trim()).filter(Boolean));
  const uniqueCadetsCount = uniqueCadetIds.size;

  // 3. Filtered logs according to active Battalion selector for contextual counts
  const bnSelectorClean = selectedBattalion ? selectedBattalion.replace(' Battalion', '').toLowerCase().trim() : '';
  const activeLogs = selectedBattalion
    ? attendanceLogs.filter(log => {
      const echelon = getScannedUnitEchelon(log);
      return (echelon.battalion || '').toLowerCase().includes(bnSelectorClean);
    })
    : attendanceLogs;

  // 4. Dynamic Battalions List from dynamicHierarchy
  const battalionsList = dynamicHierarchy.battalions.map((bn, idx) => {
    const bnName = bn.name;
    const bnNorm = normalizeBattalion(bnName);
    const scanned = attendanceLogs.filter(l => {
      const echelon = getScannedUnitEchelon(l);
      const lBnNorm = normalizeBattalion(echelon.battalion || l.battalion);
      return bnNorm && lBnNorm ? (bnNorm === lBnNorm) : false;
    }).length;
    const target = bn.targetQuota;
    const coys = bn.companies || [];
    const coysDesc = coys.length > 0
      ? `${coys.map(c => c.shortCode || c.name.replace(' Company', '')).join(', ')} • ${coys.reduce((acc, c) => acc + (c.platoons?.length || 0), 0)} Platoons`
      : 'No companies configured';
    const icon = bnName.includes('1st') ? Shield : (bnName.includes('2nd') ? Award : Layers);

    return {
      id: bn.id || `bn-${idx}`,
      name: bnName,
      shortCode: bn.shortCode || `${idx + 1}BN`,
      scanned,
      target,
      companiesDesc: coysDesc,
      icon
    };
  });

  // 5. Dynamic Active Battalion & Company Objects for Step 2 and Step 3
  const activeBnObj = dynamicHierarchy.battalions.find(b => {
    if (!selectedBattalion) return false;
    const selNorm = normalizeBattalion(selectedBattalion);
    const bNorm = normalizeBattalion(b.name);
    return selNorm && bNorm ? (selNorm === bNorm) : b.name.toLowerCase().includes(selectedBattalion.toLowerCase());
  }) || dynamicHierarchy.battalions[0] || null;

  const activeCoysList = activeBnObj && activeBnObj.companies && activeBnObj.companies.length > 0
    ? activeBnObj.companies
    : [
      { id: 'co-alpha', name: 'Alpha Company', shortCode: 'ALPHA', targetQuota: 148, platoons: [] },
      { id: 'co-bravo', name: 'Bravo Company', shortCode: 'BRAVO', targetQuota: 148, platoons: [] },
      { id: 'co-charlie', name: 'Charlie Company', shortCode: 'CHARLIE', targetQuota: 148, platoons: [] },
      { id: 'co-delta', name: 'Delta Company', shortCode: 'DELTA', targetQuota: 148, platoons: [] }
    ];

  const companyCounts = activeCoysList.map(c => {
    const target = c.targetQuota;
    const cNorm = normalizeCompany(c.name);
    const scanned = activeLogs.filter(log => {
      const echelon = getScannedUnitEchelon(log);
      const coNorm = normalizeCompany(echelon.company || log.company);
      return cNorm && coNorm ? (cNorm === coNorm) : false;
    }).length;
    const percent = target > 0 ? Math.min(100, Math.round((scanned / target) * 100)) : 0;
    return {
      key: c.shortCode || c.name,
      title: c.name,
      name: c.name,
      shortName: c.shortCode || c.name.replace(' Company', ''),
      desc: `${c.platoons?.length || 4} Platoons × Quota: ${target}`,
      target,
      scanned,
      percent
    };
  });

  // 6. Dynamic Active Company & Platoon Objects for Step 3
  const activeCoObj = activeBnObj?.companies?.find(c => {
    if (!selectedCompany) return false;
    const selNorm = normalizeCompany(selectedCompany);
    const cNorm = normalizeCompany(c.name);
    return selNorm && cNorm ? (selNorm === cNorm) : c.name.toLowerCase().includes(selectedCompany.toLowerCase());
  }) || activeBnObj?.companies?.[0] || null;

  const activePltnsList = activeCoObj && activeCoObj.platoons && activeCoObj.platoons.length > 0
    ? activeCoObj.platoons
    : [
      { id: 'pl-1', name: '1st Platoon', shortCode: '1PLTN', targetQuota: 37 },
      { id: 'pl-2', name: '2nd Platoon', shortCode: '2PLTN', targetQuota: 37 },
      { id: 'pl-3', name: '3rd Platoon', shortCode: '3PLTN', targetQuota: 37 },
      { id: 'pl-4', name: '4th Platoon', shortCode: '4PLTN', targetQuota: 37 }
    ];

  const platoonCounts = activePltnsList.map(p => {
    const pName = p.name;
    const pNorm = normalizePlatoon(pName);
    const scanned = activeLogs.filter(log => {
      const echelon = getScannedUnitEchelon(log);
      const coNorm = normalizeCompany(echelon.company || log.company);
      const plNorm = normalizePlatoon(echelon.platoon || log.platoon);
      const matchCo = selectedCompany
        ? (coNorm === normalizeCompany(selectedCompany))
        : true;
      const matchPl = pNorm && plNorm ? (pNorm === plNorm) : false;
      return matchCo && matchPl;
    }).length;
    const target = p.targetQuota;
    const percent = target > 0 ? Math.min(100, Math.round((scanned / target) * 100)) : 0;

    return {
      name: pName,
      shortCode: p.shortCode || 'PLTN',
      desc: 'Standard Platoon Formation',
      scanned,
      target,
      percent
    };
  });

  const overallPercent = totalUnitStrengthQuota > 0
    ? Math.min(100, Math.round(((uniqueCadetsCount || totalAttendanceScans) / totalUnitStrengthQuota) * 100))
    : 0;

  // 7. Navigation / Selection Handlers
  const handleSelectBattalion = (bnName) => {
    if (selectedBattalion === bnName) {
      setSelectedBattalion(null);
      setSelectedCompany(null);
      setSelectedPlatoon(null);
    } else {
      setSelectedBattalion(bnName);
      setSelectedCompany(null);
      setSelectedPlatoon(null);
    }
  };

  const handleSelectCompany = (coKeyOrName) => {
    if (selectedCompany === coKeyOrName) {
      setSelectedCompany(null);
      setSelectedPlatoon(null);
    } else {
      setSelectedCompany(coKeyOrName);
      setSelectedPlatoon(null);
    }
  };

  const handleSelectPlatoon = (plName) => {
    if (selectedPlatoon === plName) {
      setSelectedPlatoon(null);
    } else {
      setSelectedPlatoon(plName);
    }
  };

  const handleResetToAllUnits = () => {
    setSelectedBattalion(null);
    setSelectedCompany(null);
    setSelectedPlatoon(null);
  };

  const handleBackToBattalions = () => {
    setSelectedBattalion(null);
    setSelectedCompany(null);
    setSelectedPlatoon(null);
  };

  const handleBackToCompanies = () => {
    setSelectedCompany(null);
    setSelectedPlatoon(null);
  };

  const handleClearAllFilters = () => {
    setSelectedBattalion(null);
    setSelectedCompany(null);
    setSelectedPlatoon(null);
    setSearchQuery('');
    setStatusFilter(null);
  };

  const isAnyFilterActive =
    selectedBattalion !== null ||
    selectedCompany !== null ||
    selectedPlatoon !== null ||
    searchQuery.trim().length > 0 ||
    statusFilter !== null;

  // 8. Interactive Filtered Master Roster Records
  const tableFilteredCadets = reconciledRoster.filter(cadet => {
    // Search query filter (Cadet ID or Name, case-insensitive)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const id = String(cadet.cadetId || '').toLowerCase();
      const name = String(cadet.name || '').toLowerCase();
      if (!id.includes(q) && !name.includes(q)) {
        return false;
      }
    }

    let matchesBn = true;
    if (selectedBattalion) {
      const selectedBnNorm = normalizeBattalion(selectedBattalion);
      const cadetBnNorm = normalizeBattalion(cadet.battalion);
      matchesBn = selectedBnNorm && cadetBnNorm ? (selectedBnNorm === cadetBnNorm) : (cadet.battalion || '').toLowerCase().includes(selectedBattalion.toLowerCase());
    }

    let matchesCo = true;
    if (selectedCompany) {
      const selectedCoNorm = normalizeCompany(selectedCompany);
      const cadetCoNorm = normalizeCompany(cadet.company);
      matchesCo = selectedCoNorm && cadetCoNorm ? (selectedCoNorm === cadetCoNorm) : (cadet.company || '').toLowerCase().includes(selectedCompany.toLowerCase());
    }

    let matchesPl = true;
    if (selectedPlatoon) {
      const selectedPlNorm = normalizePlatoon(selectedPlatoon);
      const cadetPlNorm = normalizePlatoon(cadet.platoon);
      matchesPl = selectedPlNorm && cadetPlNorm ? (selectedPlNorm === cadetPlNorm) : false;
    }

    // Status filter from stat card click
    if (statusFilter) {
      const finalStatus = (cadet.finalDailyStatus || 'ABSENT').toUpperCase();
      const filterNorm = statusFilter.toUpperCase();
      if (finalStatus !== filterNorm) return false;
    }

    return matchesBn && matchesCo && matchesPl;
  });

  const getSelectedCompanyDisplay = () => {
    if (!selectedCompany) return '';
    return `${selectedCompany} Company`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Section Header: Tactical Analytics & Trends */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '-0.5rem' }}>
        <div>
          <h2 style={{ color: 'var(--rotc-green-dark)', fontFamily: 'Oswald, sans-serif', fontSize: '1.35rem', margin: 0, letterSpacing: '0.5px' }}>
            TACTICAL ANALYTICS & TRENDS
          </h2>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Real-time enrollment strength, formation muster volume, and active calendar schedule.
          </div>
        </div>
      </div>

      {/* Top Analytics & Calendar Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
        
        {/* Widget 1: Cadet/Employee Growth */}
        <div style={{ gridColumn: 'span 5', backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: '700', color: '#1e293b', margin: 0 }}>Cadet Growth</h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Active Enrollment ▾</span>
          </div>
          <div style={{ height: '160px', width: '100%' }}>
            <Line data={dynamicGrowthData} options={growthChartOptions} />
          </div>
        </div>

        {/* Widget 2: Attendance Trend */}
        <div style={{ gridColumn: 'span 4', backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: '700', color: '#1e293b', margin: 0 }}>Attendance Trend</h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Unique Formations ▾</span>
          </div>
          <div style={{ height: '160px', width: '100%' }}>
            <Line data={dynamicTrendData} options={attendanceChartOptions} />
          </div>
        </div>

        {/* Widget 3: Mini Calendar */}
        <div style={{ gridColumn: 'span 3', backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ cursor: 'pointer', fontSize: '0.875rem', color: '#64748b' }}>‹</span>
            <h3 style={{ fontSize: '0.875rem', fontWeight: '700', color: '#1e293b', margin: 0 }}>August 2026</h3>
            <span style={{ cursor: 'pointer', fontSize: '0.875rem', color: '#64748b' }}>›</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textTransform: 'uppercase', textAlign: 'center', fontSize: '10px', fontWeight: '600', color: '#94a3b8', gap: '4px', marginBottom: '4px' }}>
            <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: '11px', gap: '4px' }}>
            {[26, 27, 28, 29, 30, 31].map(d => <span key={d} style={{ color: '#cbd5e1', padding: '4px 0' }}>{d}</span>)}
            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
              <span
                key={day}
                style={{
                  padding: '4px 0',
                  borderRadius: '50%',
                  fontWeight: day === 24 ? '700' : '500',
                  backgroundColor: day === 24 ? '#0284c7' : 'transparent',
                  color: day === 24 ? '#ffffff' : '#334155',
                  display: 'inline-block',
                }}
              >
                {day}
              </span>
            ))}
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* Department Distribution Donut Chart Widget (Tactical College Breakdown)   */}
      {/* ========================================================================= */}
      <div
        style={{
          backgroundColor: '#ffffff',
          padding: '1.25rem 1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          marginBottom: '2rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(6, 78, 46, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--rotc-green-dark, #064e2e)'
            }}>
              <PieChart size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#1e293b', margin: 0, letterSpacing: '0.2px' }}>
                DEPARTMENT DISTRIBUTION
              </h3>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Cadet strength allocation across CSU Academic Colleges
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: '700',
              padding: '0.25rem 0.65rem',
              borderRadius: '6px',
              backgroundColor: '#f1f5f9',
              color: '#334155',
              border: '1px solid #e2e8f0'
            }}>
              {departmentDistribution.totalCount} Enrolled Cadets
            </span>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 320px) 1fr',
          gap: '2rem',
          alignItems: 'center'
        }}>
          {/* Donut Chart Container */}
          <div style={{ position: 'relative', height: '230px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Doughnut data={departmentDistribution.chartData} options={departmentDonutOptions} />
            
            {/* Center Donut Label */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none'
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#0f172a', lineHeight: 1 }}>
                {departmentDistribution.totalCount}
              </div>
              <div style={{ fontSize: '0.68rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginTop: '3px' }}>
                Total Cadets
              </div>
            </div>
          </div>

          {/* Department Breakdown Progress Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '0.75rem'
          }}>
            {departmentDistribution.deptList.map(dept => {
              const pct = departmentDistribution.totalCount > 0
                ? Math.round((dept.count / departmentDistribution.totalCount) * 100)
                : 0;

              return (
                <div
                  key={dept.key}
                  style={{
                    backgroundColor: '#f8fafc',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        display: 'inline-block',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: dept.color,
                        boxShadow: `0 0 6px ${dept.color}66`
                      }}></span>
                      <strong style={{ fontSize: '0.82rem', color: '#1e293b' }}>
                        {dept.key}
                      </strong>
                    </div>
                    <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#0f172a' }}>
                      {dept.count} <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600' }}>({pct}%)</span>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.7rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '0.4rem' }} title={dept.name}>
                    {dept.name}
                  </div>

                  <div style={{ width: '100%', height: '5px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      backgroundColor: dept.color,
                      borderRadius: '3px',
                      transition: 'width 0.5s ease-out'
                    }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className="text-2xl font-black" style={{ color: 'var(--rotc-green-dark)', fontFamily: 'Oswald, sans-serif', fontSize: '1.5rem', margin: 0, letterSpacing: '0.5px' }}>
            COMMAND DASHBOARD
          </h2>
        </div>


      </div>

      {/* Top Static Summary Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>

        {/* Card 1: Total Unit Strength */}
        <div className="card" style={{ borderLeft: '5px solid var(--rotc-green-dark)', cursor: 'default' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(6, 78, 46, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rotc-green-dark)' }}>
              <Users size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Unit Strength</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                {totalStrength} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ {totalStrength} Target Capacity</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {totalStrength > 0
              ? `100% of Enrolled Roster (${totalStrength} Cadets)`
              : '0 Cadets Registered in Master Roster'}
          </div>
        </div>

        {/* Card 2: PRESENT */}
        <div
          className="card"
          style={{
            borderLeft: `5px solid ${statusFilter === 'PRESENT' ? '#059669' : '#d1fae5'}`,
            cursor: 'pointer',
            outline: statusFilter === 'PRESENT' ? '2px solid #059669' : 'none',
            background: statusFilter === 'PRESENT' ? '#f0fdf4' : undefined
          }}
          onClick={() => handleStatusCardClick('PRESENT')}
          title="Click to filter table: PRESENT cadets only"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(5, 150, 105, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
              <CheckCircle2 size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Present</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#065f46' }}>
                {attendanceSummary.presentCompleteCount} <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cadets</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {statusFilter === 'PRESENT' ? '✓ Filtering table by Present' : 'Click to filter → Present'}
          </div>
        </div>

        {/* Card 3: LATE */}
        <div
          className="card"
          style={{
            borderLeft: `5px solid ${statusFilter === 'LATE' ? '#d97706' : '#fde68a'}`,
            cursor: 'pointer',
            outline: statusFilter === 'LATE' ? '2px solid #d97706' : 'none',
            background: statusFilter === 'LATE' ? '#fffbeb' : undefined
          }}
          onClick={() => handleStatusCardClick('LATE')}
          title="Click to filter table: LATE cadets only"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(217, 119, 6, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
              <Clock size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Late</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#92400e' }}>
                {attendanceSummary.lateCompleteCount} <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cadets</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {statusFilter === 'LATE' ? '✓ Filtering table by Late' : 'Click to filter → Late'}
          </div>
        </div>

        {/* Card 4: NO TIME-OUT */}
        <div
          className="card"
          style={{
            borderLeft: `5px solid ${statusFilter === 'NO TIME-OUT' ? '#ea580c' : '#fed7aa'}`,
            cursor: 'pointer',
            outline: statusFilter === 'NO TIME-OUT' ? '2px solid #ea580c' : 'none',
            background: statusFilter === 'NO TIME-OUT' ? '#fff7ed' : undefined
          }}
          onClick={() => handleStatusCardClick('NO TIME-OUT')}
          title="Click to filter table: No Time-Out cadets only"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(234, 88, 12, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c' }}>
              <Activity size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>No Time-Out</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#9a3412' }}>
                {attendanceSummary.incompleteCount} <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cadets</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {statusFilter === 'NO TIME-OUT' ? '✓ Filtering table by No Time-Out' : 'Click to filter → No Time-Out'}
          </div>
        </div>

        {/* Card 5: ABSENT */}
        <div
          className="card"
          style={{
            borderLeft: `5px solid ${statusFilter === 'ABSENT' ? '#64748b' : '#e2e8f0'}`,
            cursor: hasTodayScans ? 'pointer' : 'default',
            outline: statusFilter === 'ABSENT' ? '2px solid #64748b' : 'none',
            background: statusFilter === 'ABSENT' ? '#f1f5f9' : undefined
          }}
          onClick={() => hasTodayScans && handleStatusCardClick('ABSENT')}
          title={hasTodayScans ? "Click to filter table: Absent cadets only" : "No formation recorded for today"}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(100, 116, 139, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              <Shield size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                {hasTodayScans ? 'Absent' : 'No Scan Today'}
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#334155' }}>
                {hasTodayScans ? attendanceSummary.absentCount : 0} <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Cadets</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {hasTodayScans ? (statusFilter === 'ABSENT' ? '✓ Filtering table by Absent' : 'Click to filter → Absent') : 'No active formation today'}
          </div>
        </div>
      </div>



      {/* Replace old Step 1/2/3 cards with this single unified component */}
      <DashboardUnitHierarchy
        selectedBattalion={selectedBattalion}
        setSelectedBattalion={setSelectedBattalion}
        selectedCompany={selectedCompany}
        setSelectedCompany={setSelectedCompany}
        selectedPlatoon={selectedPlatoon}
        setSelectedPlatoon={setSelectedPlatoon}
      />

      {/* ========================================================================= */}
      {/* Attendance Ingestions Table (Dynamically Filtered by Active Echelons)      */}
      {/* ========================================================================= */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem' }}>
          <div>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={20} color="var(--rotc-green-dark)" />
              <span>Master Attendance Records ({tableFilteredCadets.length} Cadets)</span>
            </div>
            {isAnyFilterActive ? (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dark)', marginTop: '3px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <Filter size={13} color="var(--rotc-green-dark)" />
                <span style={{ color: 'var(--text-muted)' }}>Active filters:</span>
                {selectedBattalion && (
                  <strong
                    onClick={() => { setSelectedBattalion(null); setSelectedCompany(null); setSelectedPlatoon(null); }}
                    style={{ background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                    title="Click to clear battalion filter"
                  >
                    {selectedBattalion} ×
                  </strong>
                )}
                {selectedCompany && (
                  <strong
                    onClick={() => { setSelectedCompany(null); setSelectedPlatoon(null); }}
                    style={{ background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                    title="Click to clear company filter"
                  >
                    {getSelectedCompanyDisplay()} ×
                  </strong>
                )}
                {selectedPlatoon && (
                  <strong
                    onClick={() => setSelectedPlatoon(null)}
                    style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                    title="Click to clear platoon filter"
                  >
                    {selectedPlatoon} ×
                  </strong>
                )}
                {statusFilter && (
                  <strong
                    onClick={() => setStatusFilter(null)}
                    style={{ background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                    title="Click to clear status filter"
                  >
                    Status: {statusFilter} ×
                  </strong>
                )}
                {searchQuery.trim() && (
                  <strong
                    onClick={() => setSearchQuery('')}
                    style={{ background: '#f3e8ff', color: '#6b21a8', border: '1px solid #d8b4fe', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                    title="Click to clear search filter"
                  >
                    Search: "{searchQuery.trim()}" ×
                  </strong>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                Showing full Brigade Master Roster ({totalStrength} Cadets). Scanned cadets update to Present/Late in real-time.
              </div>
            )}
          </div>

          {/* Search Input Bar & Action Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', minWidth: '260px', maxWidth: '340px' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none'
                }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Cadet ID or Name..."
                style={{
                  width: '100%',
                  padding: '0.45rem 2rem 0.45rem 2rem',
                  fontSize: '0.82rem',
                  borderRadius: '8px',
                  border: '1.5px solid var(--border-light)',
                  background: '#f8fafc',
                  color: 'var(--text-dark)',
                  outline: 'none',
                  transition: 'all 0.15s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--rotc-green-dark)';
                  e.target.style.background = '#ffffff';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border-light)';
                  if (!searchQuery) e.target.style.background = '#f8fafc';
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {isAnyFilterActive && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleClearAllFilters}
                style={{ fontSize: '0.78rem', padding: '0.45rem 0.75rem', color: '#dc2626', borderColor: '#fca5a5', background: '#fee2e2', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                title="Reset all echelon filters and search query"
              >
                <XCircle size={14} /> Clear All
              </button>
            )}
          </div>
        </div>

        {!hasTodayScans ? (
          <div
            style={{
              padding: '3.5rem 1.5rem',
              textAlign: 'center',
              background: '#ffffff',
              borderRadius: '12px',
              border: '2px dashed #cbd5e1',
              boxShadow: 'var(--shadow-sm)',
              margin: '0.5rem 0'
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#f1f5f9',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem'
              }}
            >
              <Activity size={32} />
            </div>

            <h3 style={{ margin: '0 0 0.5rem', color: '#1e293b', fontSize: '1.25rem', fontWeight: 800 }}>
              No Active Formation or Scans Recorded for Today
            </h3>

            <p style={{ margin: '0 auto 1.5rem', maxWidth: '520px', color: '#64748b', fontSize: '0.88rem', lineHeight: '1.5' }}>
              No attendance scans have been logged for <strong>{formatHumanDate(todayKey)}</strong>. Master roster rows are hidden on non-formation days to keep the dashboard clean.
            </p>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {onNavigateToHistory && (
                <button
                  type="button"
                  onClick={onNavigateToHistory}
                  className="btn btn-primary"
                  style={{
                    padding: '0.55rem 1.25rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Archive size={15} /> View Attendance History & Past Formations
                </button>
              )}
            </div>
          </div>
        ) : tableFilteredCadets.length === 0 ? (
          <div style={{ textTransform: 'uppercase', padding: '2.5rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No cadets matching active filters {searchQuery.trim() ? `and search term "${searchQuery.trim()}"` : ''} ({selectedBattalion || 'All Battalions'}{selectedCompany ? ` • ${getSelectedCompanyDisplay()}` : ''}{selectedPlatoon ? ` • ${selectedPlatoon}` : ''}).
          </div>
        ) : (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cadet ID</th>
                  <th>Cadet Name</th>
                  <th>Battalion</th>
                  <th>Company</th>
                  <th>Platoon</th>
                  <th>Time-In</th>
                  <th>Time-Out</th>
                  <th>Status</th>
                  <th>Duty Officer</th>
                </tr>
              </thead>
              <tbody>
                {tableFilteredCadets.map((cadet, idx) => {
                  const timeInDisplay = cadet.timeIn
                    ? new Date(cadet.timeIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : null;
                  const timeOutDisplay = cadet.timeOut
                    ? new Date(cadet.timeOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : null;
                  const finalStatus = cadet.finalDailyStatus || 'ABSENT';

                  return (
                    <tr key={cadet.cadetId || idx}>
                      <td>{idx + 1}</td>
                      <td style={{ fontWeight: 700, color: 'var(--rotc-green-dark)' }}>{cadet.cadetId}</td>
                      <td style={{ fontWeight: 600 }}>{cadet.name}</td>
                      <td><span className="badge" style={{ background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe' }}>{cadet.battalion || '1st Battalion'}</span></td>
                      <td><span className="badge" style={{ background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0' }}>{cadet.company || 'Alpha Company'}</span></td>
                      <td><span className="badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>{cadet.platoon || '1st Platoon'}</span></td>

                      {/* Time-In Column */}
                      <td>
                        {timeInDisplay ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{timeInDisplay}</span>
                            {cadet.isLate ? (
                              <span className="badge" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontWeight: 800, padding: '2px 6px', fontSize: '0.7rem' }}>
                                <Clock size={10} /> LATE
                              </span>
                            ) : (
                              <span className="badge badge-present" style={{ padding: '2px 6px', fontSize: '0.7rem' }}>
                                <CheckCircle2 size={10} /> PRESENT
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No Scan</span>
                        )}
                      </td>

                      {/* Time-Out Column */}
                      <td>
                        {timeOutDisplay ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{timeOutDisplay}</span>
                            <span className="badge badge-present" style={{ padding: '2px 6px', fontSize: '0.7rem' }}>
                              <CheckCircle2 size={10} /> PRESENT
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            {cadet.hasTimeIn ? (
                              <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', fontSize: '0.68rem', padding: '2px 6px' }}>
                                NO TIME-OUT
                              </span>
                            ) : '—'}
                          </span>
                        )}
                      </td>

                      {/* Final Daily Status Badge */}
                      <td>
                        {(!hasTodayScans || finalStatus === 'NO SCAN TODAY') ? (
                          <span className="badge" style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', fontWeight: 700, gap: '3px' }}>
                            <Activity size={11} /> NO SCAN TODAY
                          </span>
                        ) : (
                          <>
                            {(finalStatus === 'PRESENT' || finalStatus === 'PRESENT (Complete)') && (
                              <span className="badge badge-present" style={{ fontWeight: 800, gap: '3px' }}>
                                <CheckCircle2 size={11} /> PRESENT
                              </span>
                            )}
                            {(finalStatus === 'LATE' || finalStatus === 'LATE (Complete)') && (
                              <span className="badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontWeight: 800, gap: '3px' }}>
                                <Clock size={11} /> LATE
                              </span>
                            )}
                            {(finalStatus === 'NO TIME-OUT' || finalStatus === 'INCOMPLETE (No Time-Out)') && (
                              <span className="badge" style={{ background: '#ffedd5', color: '#9a3412', border: '1px solid #fed7aa', fontWeight: 800, gap: '3px' }}>
                                <Activity size={11} /> NO TIME-OUT
                              </span>
                            )}
                            {(finalStatus === 'LATE / NO TIME-OUT' || finalStatus === 'INCOMPLETE (Late / No Time-Out)') && (
                              <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', fontWeight: 800, gap: '3px' }}>
                                <Activity size={11} /> LATE / NO TIME-OUT
                              </span>
                            )}
                            {finalStatus === 'ABSENT' && (
                              <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', fontWeight: 800, gap: '3px' }}>
                                <UserX size={11} /> ABSENT
                              </span>
                            )}
                            {!['PRESENT', 'PRESENT (Complete)', 'LATE', 'LATE (Complete)', 'NO TIME-OUT', 'INCOMPLETE (No Time-Out)', 'LATE / NO TIME-OUT', 'INCOMPLETE (Late / No Time-Out)', 'ABSENT', 'NO SCAN TODAY'].includes(finalStatus) && (
                              <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', fontWeight: 800, gap: '3px' }}>
                                {finalStatus}
                              </span>
                            )}
                          </>
                        )}
                      </td>

                      <td>{cadet.dutyOfficer || (hasTodayScans ? 'Duty Officer' : '—')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick History Log Banner at bottom of Live Dashboard */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #064e2e 0%, #005a36 100%)',
          color: '#ffffff',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: 'var(--shadow-md)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#e5a900'
            }}
          >
            <Archive size={24} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#ffffff' }}>
              Looking for Past Formation Logs or Absences?
            </div>
            <div style={{ fontSize: '0.8rem', color: '#d1fae5' }}>
              Access the complete archive of previous training dates, absence matrices, and turnout rate trends.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onNavigateToHistory}
          className="btn"
          style={{
            background: '#e5a900',
            color: '#064e2e',
            fontWeight: 800,
            fontSize: '0.85rem',
            padding: '0.5rem 1.1rem',
            border: 'none',
            borderRadius: '8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}
        >
          <Archive size={16} /> Open Attendance History & Archives
        </button>
      </div>
    </div>
  );
}
