import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, PieChart, Pie, Cell,
  RadialBarChart, RadialBar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Line,
} from 'recharts';
import { TrendingUp, TrendingDown, Activity, Zap, Target, Award, Download, FileText, RefreshCw } from 'lucide-react';
import { getDashboardStats, listCases } from '../services/api';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';
import { format, parseISO, subMonths } from 'date-fns';
import { useLanguage } from '../i18n/LanguageContext';

const GOLD = '#D4AF37', EMERALD = '#10B981', RUBY = '#EF4444', AMBER = '#F59E0B', PURPLE = '#8B5CF6', CYAN = '#06B6D4';
const COLORS = [GOLD, EMERALD, RUBY, AMBER, PURPLE, CYAN];
const axisStyle = { stroke: '#4A4A4A', fontSize: 11 };
const gridStyle = { strokeDasharray: '3 3', stroke: '#2A2A2A' };
const legendFmt = v => <span style={{ color: '#A3A3A3', fontSize: 11 }}>{v}</span>;

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl p-4 shadow-2xl" style={{ background: '#1A1A1A', border: '1px solid rgba(212,175,55,0.3)' }}>
      <p className="text-xs font-mono mb-2" style={{ color: GOLD }}>{label}</p>
      {payload.map((e, i) => (
        <div key={i} className="flex items-center justify-between gap-6 text-sm">
          <span style={{ color: e.color }}>{e.name}:</span>
          <span className="text-white font-bold">{e.value}</span>
        </div>
      ))}
    </div>
  );
};

const ChartGradients = () => (
  <defs>
    {[['goldGrad', GOLD], ['emeraldGrad', EMERALD], ['amberGrad', AMBER], ['rubyGrad', RUBY]].map(([id, c]) => (
      <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={c} stopOpacity={0.8} />
        <stop offset="100%" stopColor={c} stopOpacity={0.05} />
      </linearGradient>
    ))}
  </defs>
);

function Sparkline({ data, color }) {
  if (!data?.length) return <div className="h-12" />;
  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={data.map((v, i) => ({ i, v }))}>
        <defs>
          <linearGradient id={`sp${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#sp${color.replace('#','')})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function KPICard({ title, value, icon: Icon, color, sparkData, delay, loading }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} whileHover={{ y: -4 }}
      className="chamber-card p-5" style={{ background: '#0D0D0D', border: '1px solid #2A2A2A' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="p-2.5 rounded-xl" style={{ background: `${color}18` }}><Icon size={18} style={{ color }} /></div>
      </div>
      {loading ? <div className="skeleton h-7 w-20 mb-1" /> : <p className="text-2xl font-extrabold text-white mb-0.5">{value}</p>}
      <p className="text-xs mb-3" style={{ color: '#A3A3A3' }}>{title}</p>
      <Sparkline data={sparkData} color={color} />
    </motion.div>
  );
}

function ChartCard({ title, subtitle, children, delay = 0 }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay }}
      className="chamber-card p-5" style={{ background: '#0D0D0D', border: '1px solid #2A2A2A' }}>
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: '#A3A3A3' }}>{subtitle}</p>}
      </div>
      {children}
    </motion.div>
  );
}

function fmtMonth(ym) { try { return format(parseISO(ym + '-01'), 'MMM'); } catch { return ym; } }

function buildMonthSeries(rawData) {
  const map = {};
  (rawData || []).forEach(r => { map[r.month] = r.count || 0; });
  return Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), 5 - i);
    const key = format(d, 'yyyy-MM');
    return { month: fmtMonth(key), value: map[key] || 0 };
  });
}

function buildDirMonthSeries(rawData) {
  const map = {};
  (rawData || []).forEach(r => { map[r.month] = { pending: r.pending || 0, approved: r.approved || 0, rejected: r.rejected || 0 }; });
  return Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), 5 - i);
    const key = format(d, 'yyyy-MM');
    return { month: fmtMonth(key), ...(map[key] || { pending: 0, approved: 0, rejected: 0 }) };
  });
}

export default function Reports() {
  const { t } = useLanguage();
  const [timeRange, setTimeRange] = useState('monthly');

  const { data: stats, isLoading: sl, refetch: rs } = useQuery({ queryKey: ['dashboard-stats'], queryFn: getDashboardStats, refetchInterval: 30_000 });
  const { data: cases = [], isLoading: cl, refetch: rc } = useQuery({ queryKey: ['cases'], queryFn: listCases, refetchInterval: 30_000 });
  const loading = sl || cl;

  const totalDirs = stats?.total_directives ?? 0;
  const pendingDirs = stats?.pending_directives ?? 0;
  const approvedDirs = stats?.approved_directives ?? 0;
  const rejectedDirs = stats?.rejected_directives ?? 0;
  const overdueDirs = stats?.overdue_directives ?? 0;
  const verifiedCases = stats?.verified_cases ?? 0;
  const complianceRate = stats?.compliance_rate ?? 0;
  const avgDirs = stats?.avg_directives_per_case ?? 0;

  const deptData = (stats?.department_stats || []).map((d, i) => ({
    name: d.name.length > 22 ? d.name.slice(0, 20) + '…' : d.name,
    fullName: d.name, value: d.value, fill: COLORS[i % COLORS.length],
  }));

  const casesByMonth = buildMonthSeries(stats?.cases_by_month || []);
  const dirsByMonth = buildDirMonthSeries(stats?.directives_by_month || []);
  const complianceTrend = dirsByMonth.map(m => {
    const tot = m.approved + m.pending + m.rejected;
    return { month: m.month, compliance: tot > 0 ? Math.round((m.approved / tot) * 100) : 0, target: 85 };
  });

  const statusDonut = [
    { name: t('verify_approved'), value: approvedDirs, color: EMERALD },
    { name: t('sidebar_pending'), value: pendingDirs, color: AMBER },
    { name: t('dir_rejected'), value: rejectedDirs, color: RUBY },
    { name: t('sidebar_overdue'), value: overdueDirs, color: '#EF4444' },
  ].filter(d => d.value > 0);

  const exportFullReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('NyayaSetu — Compliance Analytics Report', 14, 20);
    doc.setFontSize(10); doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, 30);
    autoTable(doc, {
      startY: 44, head: [['Metric', 'Value']],
      body: [['Total Cases', stats?.total_cases ?? 0], ['Verified Cases', verifiedCases], ['Total Directives', totalDirs],
        ['Approved', approvedDirs], ['Pending', pendingDirs], ['Overdue', overdueDirs], ['Compliance Rate', `${complianceRate}%`]],
      styles: { fontSize: 9 }, headStyles: { fillColor: [212, 175, 55] },
    });
    doc.save(`nyayasetu_report_${format(new Date(), 'yyyyMMdd')}.pdf`);
    toast.success(t('export_pdf_success'));
  };

  const exportCSV = () => {
    const rows = cases.map(c => ({
      'Case Number': c.case_number, Court: c.court,
      'Judgment Date': c.judgment_date ? format(new Date(c.judgment_date), 'yyyy-MM-dd') : '',
      Status: c.status, 'Total Directives': c.directives?.length || 0,
      Approved: c.directives?.filter(d => d.status === 'approved').length || 0,
      Pending: c.directives?.filter(d => d.status === 'pending').length || 0,
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `nyayasetu_cases_${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(t('export_csv_success'));
  };

  const noData = (msg) => <div className="h-64 flex items-center justify-center text-sm" style={{ color: '#4A4A4A' }}>{msg}</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">{t('reports_heading')}</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{t('reports_subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#0D0D0D', border: '1px solid #2A2A2A' }}>
            {['daily','weekly','monthly','quarterly'].map(r => (
              <button key={r} onClick={() => setTimeRange(r)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize"
                style={timeRange === r ? { background: GOLD, color: '#0D0D0D', fontWeight: 600 } : { color: '#A3A3A3' }}>
                {t(`reports_${r}`)}
              </button>
            ))}
          </div>
          <button onClick={() => { rs(); rc(); toast.success(t('reports_refreshed')); }} className="btn-ghost text-xs">
            <RefreshCw size={13} /> {t('reports_refresh')}
          </button>
          <button onClick={exportCSV} className="btn-ghost text-xs"><Download size={13} /> {t('reports_csv')}</button>
          <button onClick={exportFullReport} className="btn-gold text-xs"><FileText size={13} /> {t('reports_export')}</button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <KPICard title={t('reports_compliance_rate')} icon={Target} color={GOLD} delay={0} loading={loading} value={loading ? '—' : `${complianceRate}%`} sparkData={complianceTrend.map(m => m.compliance)} />
        <KPICard title={t('reports_total_dirs')} icon={Activity} color={EMERALD} delay={0.07} loading={loading} value={loading ? '—' : totalDirs} sparkData={casesByMonth.map(m => m.value)} />
        <KPICard title={t('reports_pending_review')} icon={Zap} color={AMBER} delay={0.14} loading={loading} value={loading ? '—' : pendingDirs} sparkData={dirsByMonth.map(m => m.pending)} />
        <KPICard title={t('reports_active_depts')} icon={Award} color={PURPLE} delay={0.21} loading={loading} value={loading ? '—' : deptData.length} sparkData={deptData.map(d => d.value)} />
      </div>

      {/* Main charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title={t('reports_compliance_trend')} subtitle={t('reports_trend_subtitle')} delay={0.1}>
          {complianceTrend.every(m => m.compliance === 0) ? noData(t('reports_no_data')) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={complianceTrend}>
                <ChartGradients />
                <CartesianGrid {...gridStyle} /><XAxis dataKey="month" tick={axisStyle} /><YAxis tick={axisStyle} domain={[0,100]} unit="%" />
                <Tooltip content={<CustomTooltip />} /><Legend iconType="circle" iconSize={8} formatter={legendFmt} />
                <Area type="monotone" dataKey="compliance" name={t('reports_compliance_rate')} stroke={GOLD} fill="url(#goldGrad)" strokeWidth={3} />
                <Line type="monotone" dataKey="target" name={t('reports_target')} stroke="#4A4A4A" strokeDasharray="5 5" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={t('reports_dept_load')} subtitle={t('reports_dept_subtitle')} delay={0.15}>
          {deptData.length === 0 ? noData(t('reports_no_dept')) : (
            <ResponsiveContainer width="100%" height={280}>
              <RadialBarChart cx="50%" cy="50%" innerRadius="15%" outerRadius="85%" data={deptData} startAngle={180} endAngle={0}>
                <RadialBar minAngle={15} background clockWise dataKey="value" cornerRadius={8} label={{ fill: '#A3A3A3', fontSize: 10, position: 'insideStart' }} />
                <Legend iconSize={8} layout="vertical" verticalAlign="middle" align="right" formatter={legendFmt} />
                <Tooltip content={<CustomTooltip />} />
              </RadialBarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={t('reports_dir_activity')} subtitle={t('reports_dir_subtitle')} delay={0.2}>
          {dirsByMonth.every(m => m.approved + m.pending + m.rejected === 0) ? noData(t('reports_no_activity')) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dirsByMonth}>
                <CartesianGrid {...gridStyle} /><XAxis dataKey="month" tick={axisStyle} /><YAxis tick={axisStyle} />
                <Tooltip content={<CustomTooltip />} /><Legend iconType="circle" iconSize={8} formatter={legendFmt} />
                <Bar dataKey="approved" name={t('verify_approved')} stackId="a" fill={EMERALD} />
                <Bar dataKey="pending" name={t('sidebar_pending')} stackId="a" fill={AMBER} />
                <Bar dataKey="rejected" name={t('dir_rejected')} stackId="a" fill={RUBY} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={t('reports_cases_uploaded')} subtitle={t('reports_cases_subtitle')} delay={0.25}>
          {casesByMonth.every(m => m.value === 0) ? noData(t('reports_no_cases')) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={casesByMonth}>
                <ChartGradients /><CartesianGrid {...gridStyle} /><XAxis dataKey="month" tick={axisStyle} /><YAxis tick={axisStyle} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" name={t('nav_cases')} stroke={GOLD} fill="url(#goldGrad)" strokeWidth={3} dot={{ fill: GOLD, r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title={t('reports_status_breakdown')} subtitle={t('reports_status_subtitle')} delay={0.3}>
          {statusDonut.length === 0 ? noData(t('reports_no_directives')) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusDonut} cx="50%" cy="50%" innerRadius={65} outerRadius={100} paddingAngle={4} dataKey="value">
                  {statusDonut.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} /><Legend iconType="circle" iconSize={8} formatter={legendFmt} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={t('reports_dept_dist')} subtitle={t('reports_dept_dist_subtitle')} delay={0.35}>
          {deptData.length === 0 ? noData(t('reports_no_dept')) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={deptData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid {...gridStyle} /><XAxis type="number" tick={axisStyle} allowDecimals={false} /><YAxis type="category" dataKey="name" tick={axisStyle} width={130} />
                <Tooltip content={<CustomTooltip />} labelFormatter={(l, p) => p[0]?.payload?.fullName || l} />
                <Bar dataKey="value" name={t('dash_directives')} radius={[0,4,4,0]}>
                  {deptData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Summary stats */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { labelKey: 'reports_verified_cases', value: verifiedCases, color: EMERALD },
          { labelKey: 'reports_overdue_dirs',   value: overdueDirs,   color: RUBY },
          { labelKey: 'reports_avg_dirs',       value: avgDirs,       color: GOLD },
          { labelKey: 'reports_total_processed',value: totalDirs,     color: PURPLE },
        ].map(({ labelKey, value, color }) => (
          <div key={labelKey} className="chamber-card p-4 text-center" style={{ background: '#0D0D0D', border: '1px solid #2A2A2A' }}>
            {loading ? <div className="skeleton h-7 w-12 mx-auto mb-1" /> : <p className="text-2xl font-extrabold text-white">{value}</p>}
            <p className="text-xs mt-1" style={{ color: '#A3A3A3' }}>{t(labelKey)}</p>
            <div className="mt-2 h-1 rounded-full" style={{ background: `${color}30` }}>
              <div className="h-full rounded-full" style={{ background: color, width: '60%' }} />
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
