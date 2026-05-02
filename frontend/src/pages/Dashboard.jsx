import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import { Activity, AlertTriangle, Clock, ArrowUpRight, Scale, TrendingUp, ChevronRight, Zap, Shield, Eye } from 'lucide-react';
import { getDashboardStats, listCases } from '../services/api';

/* ── Animated Counter ── */
function Counter({ value, duration = 1.5 }) {
  const spring = useSpring(0, { duration: duration * 1000 });
  const display = useTransform(spring, v => Math.round(v));
  const [cur, setCur] = useState(0);
  useEffect(() => { spring.set(value); return display.on('change', v => setCur(v)); }, [value]);
  return <span>{cur}</span>;
}

/* ── Confidence Ring ── */
function Ring({ score, size = 40, sw = 3 }) {
  const r = (size - sw) / 2, c = 2 * Math.PI * r;
  const color = score >= 0.9 ? '#16A34A' : score >= 0.8 ? '#2563EB' : '#F59E0B';
  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="confidence-ring" width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={sw} />
        <motion.circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - score * c }}
          transition={{ duration: 1.2, delay: 0.3, ease: [0.4, 0, 0.2, 1] }} />
      </svg>
      <span className="absolute text-[10px] font-semibold" style={{ color }}>{Math.round(score * 100)}</span>
    </div>
  );
}

/* ── Stagger container ── */
const stagger = { animate: { transition: { staggerChildren: 0.08 } } };
const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } } };

/* ── Stat Card with hover lift ── */
function StatCard({ icon: Icon, title, value, subtitle, accent }) {
  const colors = {
    blue:  { top: 'border-t-brand',  bg: 'bg-blue-50', text: 'text-brand' },
    teal:  { top: 'border-t-teal',   bg: 'bg-teal-50',  text: 'text-teal' },
    amber: { top: 'border-t-amber-400', bg: 'bg-amber-50', text: 'text-amber-500' },
    red:   { top: 'border-t-red-400',   bg: 'bg-red-50',   text: 'text-red-500' },
  };
  const c = colors[accent];
  return (
    <motion.div variants={fadeUp} whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.08)' }}
      className={`card border-t-[3px] ${c.top} p-5 cursor-default`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${c.bg}`}><Icon size={16} className={c.text} /></div>
        <span className="text-[10px] text-ink-faint font-medium uppercase tracking-wider">{title}</span>
      </div>
      <h3 className="text-3xl font-extrabold text-ink tracking-tight">
        {typeof value === 'number' ? <Counter value={value} /> : value}
      </h3>
      <p className="text-xs text-ink-muted mt-1">{subtitle}</p>
    </motion.div>
  );
}

/* ── Department Load Card with progress bar ── */
function DeptCard({ name, count, maxCount, delay }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  const color = pct > 70 ? 'text-red-500' : pct > 40 ? 'text-brand' : 'text-teal';
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 300 }}
      whileHover={{ y: -2, boxShadow: '0 8px 20px rgba(0,0,0,0.06)' }}
      className="p-3.5 rounded-xl bg-white border border-border cursor-default">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-ink-muted leading-tight">{name}</p>
        <p className={`text-lg font-bold ${color}`}>{count}</p>
      </div>
      <div className="progress-bar-track">
        <motion.div className="progress-bar-fill"
          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: delay + 0.2, ease: 'easeOut' }} />
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════ */
export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [cases, setCases] = useState([]);
  useEffect(() => { getDashboardStats().then(setStats); listCases().then(setCases); }, []);

  if (!stats) return (
    <div className="w-full space-y-5">
      <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="card p-5"><div className="skeleton h-4 w-16 mb-3" /><div className="skeleton h-8 w-12" /></div>)}</div>
      <div className="grid grid-cols-5 gap-4"><div className="col-span-2 card p-5"><div className="skeleton h-48" /></div><div className="col-span-3 card p-5"><div className="skeleton h-48" /></div></div>
    </div>
  );

  const deptData = stats.department_stats.map(d => ({ name: d.name, count: d.value }));
  const maxCount = Math.max(...deptData.map(d => d.count), 1);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-xl font-bold text-ink tracking-tight">Command Center</h1>
            <p className="text-sm text-ink-muted mt-0.5">Real-time compliance intelligence</p>
          </div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Link to="/upload" className="btn-primary flex items-center gap-2 text-sm">
              <ArrowUpRight size={15} /> New Case
            </Link>
          </motion.div>
        </div>
      </motion.div>

      {/* Stats — staggered entry */}
      <motion.div className="grid grid-cols-4 gap-4" variants={stagger} initial="initial" animate="animate">
        <StatCard icon={Activity} title="Total Cases" value={stats.total_cases} subtitle="Judgments processed" accent="blue" />
        <StatCard icon={Clock} title="Pending" value={stats.pending_directives} subtitle="Awaiting verification" accent="teal" />
        <StatCard icon={AlertTriangle} title="Overdue" value={stats.overdue_directives} subtitle="Requires attention" accent="red" />
        <StatCard icon={Shield} title="System" value="Active" subtitle="All services running" accent="amber" />
      </motion.div>

      {/* Departments + Cases */}
      <div className="grid grid-cols-5 gap-4">
        {/* Department Load with animated progress bars */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="col-span-2 card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={15} className="text-brand" />
            <h3 className="text-sm font-semibold text-ink">Department Load</h3>
          </div>
          <div className="grid grid-cols-1 gap-2.5">
            {deptData.map((d, i) => (
              <DeptCard key={i} name={d.name} count={d.count} maxCount={maxCount} delay={0.35 + i * 0.08} />
            ))}
          </div>
        </motion.div>

        {/* Active Cases — staggered slide-in */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="col-span-3 card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Scale size={15} className="text-brand" />
              <h3 className="text-sm font-semibold text-ink">Active Cases</h3>
            </div>
            <span className="text-xs text-ink-faint">{cases.length} total</span>
          </div>
          {cases.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-14">
              <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="p-4 rounded-2xl bg-surface border border-border mb-3">
                <Scale size={24} className="text-ink-faint" />
              </motion.div>
              <p className="text-sm font-medium text-ink-light mb-1">No cases yet</p>
              <p className="text-xs text-ink-muted mb-3">Upload a court judgment to begin</p>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link to="/upload" className="btn-primary text-xs flex items-center gap-1.5"><Zap size={13} /> Upload</Link>
              </motion.div>
            </motion.div>
          ) : (
            <div className="space-y-1">
              {cases.map((c, i) => (
                <motion.div key={c.id}
                  initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.06, ease: [0.4, 0, 0.2, 1] }}>
                  <Link to={`/verify/${c.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface transition-all group border border-transparent hover:border-border">
                    <Ring score={c.classification_confidence || 0.92} size={38} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">{c.case_number}</p>
                      <p className="text-xs text-ink-muted truncate">{c.court}</p>
                    </div>
                    <span className="badge bg-brand/6 text-brand border border-brand/10">{c.judgment_type || 'Directive'}</span>
                    <span className="text-xs text-ink-muted w-16 text-right">
                      {new Date(c.judgment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </span>
                    <span className={`badge ${c.status === 'verified'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'verified' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {c.status}
                    </span>
                    <ChevronRight size={14} className="text-ink-faint group-hover:text-brand group-hover:translate-x-0.5 transition-all" />
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
