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
  ArrowRight
} from 'lucide-react';
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
import { getSupabaseClient } from '../utils/supabaseClient';

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

// Options for Attendance Trend (Percentages)
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

// Options for Cadet Growth (Raw Totals)
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

// Options for Department Distribution Donut Chart
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
  const [currentCalendarDate, setCurrentCalendarDate] = useState(() => new Date());

  const [growthData, setGrowthData] = useState({
    labels: ['Aug 2026'],
    datasets: [{
      fill: true,
      label: 'Total Cadets Registered',
      data: [propsCadets?.length || 12],
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
        const client = getSupabaseClient();
        let totalCount = propsCadets?.length || 12;
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
            cadets.forEach(c => {
              const d = c.created_at ? new Date(c.created_at) : new Date();
              const monthKey = !isNaN(d.getTime())
                ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                : '2026-08';
              monthlyGrowthMap.set(monthKey, (monthlyGrowthMap.get(monthKey) || 0) + 1);
            });
          }
        }

        if (isMounted) {
          const sortedMonthKeys = Array.from(monthlyGrowthMap.keys()).sort();
          const growthLabels = sortedMonthKeys.length > 0
            ? sortedMonthKeys.map(k => {
              const [y, m] = k.split('-').map(Number);
              const dateObj = new Date(y, (m || 1) - 1, 1);
              return !isNaN(dateObj.getTime())
                ? dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                : k;
            })
            : ['Aug 2026'];

          let runningTotal = 0;
          const growthCounts = sortedMonthKeys.length > 0
            ? sortedMonthKeys.map(k => {
              runningTotal += (monthlyGrowthMap.get(k) || 0);
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

        // Attendance Trend
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
            const { data: sessions } = await client
              .from('attendance_sessions')
              .select('session_date, total_scanned, present_count, late_count')
              .order('session_date', { ascending: true });

            if (sessions && sessions.length > 0) {
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

        const unitCapacity = totalCount > 0 ? totalCount : 12;
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

    return () => {
      isMounted = false;
    };
  }, [propsCadets, propsLogs]);

  // Department Distribution (Official CSU Colleges)
  const departmentDistribution = useMemo(() => {
    const cadetList = propsCadets || [];

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
  }, [propsCadets]);

  // Calendar Helpers
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  const monthName = currentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

  const prevMonthPadding = [];
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    prevMonthPadding.push(totalDaysInPrevMonth - i);
  }

  const daysArray = Array.from({ length: totalDaysInMonth }, (_, i) => i + 1);

  const isCurrentDayToday = (day) => {
    const now = new Date();
    return now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
  };

  const handlePrevMonth = () => {
    setCurrentCalendarDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentCalendarDate(new Date(year, month + 1, 1));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Section Header: Analytics & Reports */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ color: 'var(--rotc-green-dark)', fontFamily: 'Oswald, sans-serif', fontSize: '1.45rem', margin: 0, letterSpacing: '0.5px' }}>
            ANALYTICS & REPORTS
          </h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Cadet enrollment growth, formation attendance percentages, interactive training calendar, and academic strength distribution reports.
          </div>
        </div>

        {onNavigateToHistory && (
          <button
            type="button"
            onClick={onNavigateToHistory}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              fontSize: '0.82rem',
              padding: '0.45rem 0.9rem'
            }}
          >
            <Archive size={15} /> View Attendance History
          </button>
        )}
      </div>

      {/* 3-Column Top Row: Cadet Growth | Attendance Trend | Formation Calendar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5rem' }}>
        {/* Widget 1: Cadet Growth */}
        <div style={{ gridColumn: 'span 5', backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={16} color="var(--rotc-green-dark)" />
              <h3 style={{ fontSize: '0.875rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>Cadet Growth</h3>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '9999px' }}>
              Active Enrollment
            </span>
          </div>
          <div style={{ height: '180px', width: '100%' }}>
            <Line data={growthData} options={growthChartOptions} />
          </div>
        </div>

        {/* Widget 2: Attendance Trend */}
        <div style={{ gridColumn: 'span 4', backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={16} color="#0284c7" />
              <h3 style={{ fontSize: '0.875rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>Attendance Trend</h3>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#0284c7', background: '#e0f2fe', padding: '2px 8px', borderRadius: '9999px' }}>
              Formation %
            </span>
          </div>
          <div style={{ height: '180px', width: '100%' }}>
            <Line data={trendData} options={attendanceChartOptions} />
          </div>
        </div>

        {/* Widget 3: Interactive Formation Calendar */}
        <div style={{ gridColumn: 'span 3', backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <button
              type="button"
              onClick={handlePrevMonth}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px 4px' }}
              title="Previous Month"
            >
              <ChevronLeft size={16} />
            </button>
            <h3 style={{ fontSize: '0.875rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>{monthName}</h3>
            <button
              type="button"
              onClick={handleNextMonth}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px 4px' }}
              title="Next Month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textTransform: 'uppercase', textAlign: 'center', fontSize: '10px', fontWeight: '700', color: '#94a3b8', gap: '3px', marginBottom: '4px' }}>
            <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: '11px', gap: '3px' }}>
            {prevMonthPadding.map(d => <span key={`prev-${d}`} style={{ color: '#cbd5e1', padding: '4px 0' }}>{d}</span>)}
            {daysArray.map(day => {
              const isToday = isCurrentDayToday(day);
              return (
                <span
                  key={`day-${day}`}
                  style={{
                    padding: '4px 0',
                    borderRadius: '50%',
                    fontWeight: isToday ? '800' : '500',
                    backgroundColor: isToday ? '#0284c7' : 'transparent',
                    color: isToday ? '#ffffff' : '#334155',
                    display: 'inline-block',
                    boxShadow: isToday ? '0 2px 5px rgba(2, 132, 199, 0.35)' : 'none'
                  }}
                >
                  {day}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Department Distribution (Tactical Academic College Breakdown) */}
      <div
        style={{
          backgroundColor: '#ffffff',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
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
              <h3 style={{ fontSize: '1rem', fontWeight: '800', color: '#1e293b', margin: 0, letterSpacing: '0.2px' }}>
                DEPARTMENT DISTRIBUTION
              </h3>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Cadet strength allocation across CSU Academic Colleges
              </div>
            </div>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 320px) 1fr',
          gap: '2.5rem',
          alignItems: 'center'
        }}>
          {/* Donut Chart Container */}
          <div style={{ position: 'relative', height: '240px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
              <div style={{ fontSize: '1.65rem', fontWeight: '900', color: '#0f172a', lineHeight: 1 }}>
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
                    padding: '0.7rem 0.9rem',
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
    </div>
  );
}

export { AnalyticsView as AnalyticsReportsView };

