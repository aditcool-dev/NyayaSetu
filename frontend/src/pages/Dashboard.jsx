import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useSpring, useTransform } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Scale, Clock, CheckCircle, AlertTriangle, TrendingUp,
  ArrowRight, FileCheck, Download, Zap, ChevronRight,
  Calendar, Building2, Activity,
} from 'lucide-react';
import { getDashboardStats, listCases } from '../services/api';
import { format, formatDistanceToNow } from 'date-fns';
import { useLanguage } from '../i18n/LanguageContext';

/* ── Animated Counter ── */
function Counter({ value }) {
  const spring = useSpring(0, { duration: 1200 });
  const display = useTransform(spring, (v) => Math.round(v));
  spring.set(value);
  return <motion.span>{display}</motion.span>;
}

/* ── Confidence Ring (gold variant) ── */
function ConfidenceRing({ score, size = 38, sw = 3 }) {
  const r = (size - sw) / 2, c = 2 * Math.PI * r;
  const color = score >= 0.9 ? '#10B981' : score >= 0.8 ? '#D4AF37' : '#F59E0B';
  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg style={{ transform: 'rotate(-90deg)' }} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2A2A2A" strokeWidth={sw} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - score * c }}
          transition={{ duration: 1.2, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
        />
      </svg>
      <span className="absolute text-[9px] font-bold" style={{ color }}>{Math.round(score * 100)}</span>
    </div>
  );
}

/* ── Stat Card ── */
function StatCard({ icon: Icon, title, value, subtitle, iconColor, trend }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, boxShadow: '0 16px 40px rgba(0,0,0,0.2)' }}
      className="chamber-card p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="p-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <Icon size={18} style={{ color: iconColor }} />
        </div>
        {trend != null && (
          <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
            <TrendingUp size={11} /> {trend}%
          </span>
        )}
      </div>
      <p className="text-3xl font-extrabold text-white tracking-tight mb-1">
        {typeof value === 'number' ? <Counter value={value} /> : value}
      </p>
      <p className="text-xs text-[#A3A3A3]">{subtitle}</p>
      <p className="text-[10px] text-[#4A4A4A] mt-1 uppercase tracking-wider font-medium">{title}</p>
    </motion.div>
  );
}

/* ── Department Bar ── */
function DeptBar({ name, count, maxCount, delay }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  const color = pct > 70 ? '#EF4444' : pct > 40 ? '#D4AF37' : '#10B981';
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-[#A3A3A3] truncate pr-2">{name}</span>
        <span className="text-sm font-bold shrink-0" style={{ color }}>{count}</span>
      </div>
      <div className="progress-bar-track" style={{ height: 5 }}>
        <motion.div
          className="progress-bar-fill"
          style={{ height: '100%', background: `linear-gradient(90deg, ${color}, ${color}88)` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: delay + 0.2, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════ */
export default function Dashboard() {
  const { t } = useLanguage();
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    refetchInterval: 30_000,
  });

  const { data: cases = [], isLoading: casesLoading } = useQuery({
    queryKey: ['cases'],
    queryFn: listCases,
    refetchInterval: 30_000,
  });

  const isLoading = statsLoading || casesLoading;

  if (isLoading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="chamber-card p-6">
            <div className="skeleton h-4 w-16 mb-3" />
            <div className="skeleton h-8 w-12" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-5">
        <div className="chamber-card p-6 col-span-2"><div className="skeleton h-64" /></div>
        <div className="chamber-card p-6"><div className="skeleton h-64" /></div>
      </div>
    </div>
  );

  const deptData = (stats?.department_stats || []).map((d) => ({ name: d.name, count: d.value }));
  const maxCount = Math.max(...deptData.map((d) => d.count), 1);
  const recentCases = cases.slice(0, 8);
  const recentActivity = stats?.recent_activity || [];

  return (
    <div className="space-y-6">
      {/* ── Welcome Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="chamber-card p-7 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0D0D0D 0%, #1A1A1A 100%)' }}
      >
        {/* Gold shimmer line */}
        <div className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)' }} />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1.5">{t('dash_welcome')}</h1>
            <p className="text-[#A3A3A3] text-sm">{t('dash_subtitle')}</p>
          </div>
          <div className="flex gap-3">
            <Link to="/reports" className="btn-ghost text-sm">
              <Download size={14} /> {t('dash_export')}
            </Link>
            <Link to="/upload" className="btn-gold text-sm">
              <FileCheck size={14} /> {t('dash_new_case')}
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard icon={Scale}         title={t('dash_total_cases')} value={stats?.total_cases || 0}                                                subtitle={t('dash_judgments_processed')} iconColor="#D4AF37" />
        <StatCard icon={Clock}         title={t('dash_pending')}     value={stats?.pending_directives || 0}                                         subtitle={t('dash_awaiting_verification')} iconColor="#F59E0B" />
        <StatCard icon={CheckCircle}   title={t('dash_verified')}    value={stats?.verified_cases ?? cases.filter(c => c.status === 'verified').length} subtitle={t('dash_cases_fully_verified')} iconColor="#10B981" />
        <StatCard icon={AlertTriangle} title={t('dash_overdue')}     value={stats?.overdue_directives || 0}                                         subtitle={t('dash_requires_attention')} iconColor="#EF4444" />
      </div>

      {/* ── Main 3-col layout ── */}
      <div className="grid grid-cols-3 gap-5">
        {/* Cases Table — 2 cols */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="col-span-2 chamber-card overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2A2A]">
            <div className="flex items-center gap-2">
              <Scale size={15} className="text-[#D4AF37]" />
              <h3 className="text-sm font-semibold text-white">{t('dash_recent_cases')}</h3>
            </div>
            <Link to="/cases" className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1">
              {t('dash_view_all')} <ArrowRight size={12} />
            </Link>
          </div>

          {recentCases.length === 0 ? (
            <div className="flex flex-col items-center py-16">
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="p-4 rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A] mb-3"
              >
                <Scale size={24} className="text-[#4A4A4A]" />
              </motion.div>
              <p className="text-sm font-medium text-[#A3A3A3] mb-1">{t('dash_no_cases')}</p>
              <p className="text-xs text-[#4A4A4A] mb-4">{t('dash_upload_to_begin')}</p>
              <Link to="/upload" className="btn-gold text-xs">
                <Zap size={13} /> {t('dash_upload')}
              </Link>
            </div>
          ) : (
            <table className="chamber-table">
              <thead>
                <tr>
                  <th>{t('dash_case_number')}</th>
                  <th>{t('dash_court')}</th>
                  <th>{t('dash_directives')}</th>
                  <th>{t('dash_date')}</th>
                  <th>{t('dash_status')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recentCases.map((c, i) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                  >
                    <td>
                      <div className="flex items-center gap-2">
                        <ConfidenceRing score={c.classification_confidence || 0.9} />
                        <span className="font-semibold text-white">{c.case_number}</span>
                      </div>
                    </td>
                    <td className="text-[#A3A3A3] max-w-[140px] truncate">{c.court}</td>
                    <td>
                      <span className="gold-badge">{c.directives?.length || 0}</span>
                    </td>
                    <td className="text-[#A3A3A3]">
                      {c.judgment_date ? format(new Date(c.judgment_date), 'dd MMM yy') : '—'}
                    </td>
                    <td>
                      <span className={`badge ${
                        c.status === 'verified'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'verified' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {c.status}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/verify/${c.id}`}
                        className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1"
                      >
                        {t('dash_review')} <ChevronRight size={12} />
                      </Link>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Department Load */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="chamber-card p-5"
          >
            <div className="flex items-center gap-2 mb-5">
              <Building2 size={14} className="text-[#D4AF37]" />
              <h3 className="text-sm font-semibold text-white">{t('dash_dept_load')}</h3>
            </div>
            {deptData.length === 0 ? (
              <p className="text-xs text-[#4A4A4A] text-center py-6">{t('dash_no_data')}</p>
            ) : (
              <div className="space-y-4">
                {deptData.map((d, i) => (
                  <DeptBar key={i} name={d.name} count={d.count} maxCount={maxCount} delay={0.35 + i * 0.07} />
                ))}
              </div>
            )}
          </motion.div>

          {/* Compliance Rate card — real data */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl p-5 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #B49450)' }}
          >
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10"
              style={{ background: '#0D0D0D', transform: 'translate(30%, -30%)' }} />
            <div className="flex items-center justify-between mb-3">
              <Zap size={20} className="text-[#0D0D0D]" />
              <span className="text-[10px] text-[#0D0D0D]/70 font-semibold uppercase tracking-wider">Live</span>
            </div>
            <p className="text-[#0D0D0D] text-3xl font-extrabold mb-0.5">
              {stats?.compliance_rate ?? 0}%
            </p>
            <p className="text-[#0D0D0D]/70 text-xs font-medium">{t('dash_compliance_rate')}</p>
            <div className="mt-3 h-1.5 bg-[#0D0D0D]/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#0D0D0D] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${stats?.compliance_rate ?? 0}%` }}
                transition={{ duration: 1, delay: 0.5 }}
              />
            </div>
            <p className="text-[10px] text-[#0D0D0D]/50 mt-2">
              {stats?.approved_directives ?? 0} approved / {stats?.total_directives ?? 0} total
            </p>
          </motion.div>

          {/* Recent Activity */}
          {recentActivity.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="chamber-card p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <Activity size={14} className="text-[#D4AF37]" />
                <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
              </div>
              <div className="space-y-3">
                {recentActivity.slice(0, 5).map((a, i) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.05 }}
                    className="flex items-start gap-2.5"
                  >
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                      style={{ background: a.action === 'approve' ? '#10B981' : a.action === 'reject' ? '#EF4444' : '#D4AF37' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white">
                        <span className="font-medium">{a.officer_name}</span>
                        {' '}
                        <span style={{ color: a.action === 'approve' ? '#10B981' : a.action === 'reject' ? '#EF4444' : '#D4AF37' }}>
                          {a.action}d
                        </span>
                        {' directive'}
                        {a.notes && <span style={{ color: '#4A4A4A' }}> · {a.notes.slice(0, 30)}{a.notes.length > 30 ? '…' : ''}</span>}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: '#4A4A4A' }}>
                        {formatDistanceToNow(new Date(a.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
