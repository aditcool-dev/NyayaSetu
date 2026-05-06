import { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft, CheckCircle, ChevronDown, ChevronUp,
  LayoutList, Clock, Building, Scale, Calendar,
  Sparkles, AlertTriangle, GitBranch, CheckCheck,
  Upload, FolderOpen, ChevronRight, Search, Shield,
  FileText, TrendingUp, Zap,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

import { getCase, verifyDirective, listCases, getDashboardStats, API_URL } from '../services/api';
import DirectiveCard from '../components/DirectiveCard';
import BatchActionBar from '../components/BatchActionBar';
import FilterBar from '../components/FilterBar';
import ExportMenu from '../components/ExportMenu';
import { useAppStore } from '../stores/appStore';

// ─── Gold / obsidian palette constants ───────────────────────────────────────
const GOLD = '#D4AF37';
const OBSIDIAN = '#0D0D0D';
const OBSIDIAN_2 = '#1A1A1A';
const OBSIDIAN_3 = '#2A2A2A';
const SUCCESS = '#10B981';
const WARNING = '#F59E0B';

// ─── Reveal: scroll-triggered fade-in ────────────────────────────────────────
function Reveal({ children, delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 18 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ─── WorkflowGraph: departments as dark nodes with gold flow edges ────────────
function WorkflowGraph({ departments }) {
  if (!departments || departments.length < 2) return null;
  return (
    <Reveal delay={0.1}>
      <div
        className="chamber-card p-4"
        style={{ background: OBSIDIAN, border: `1px solid ${OBSIDIAN_3}` }}
      >
        <div className="flex items-center gap-2 mb-3">
          <GitBranch size={13} style={{ color: GOLD }} />
          <span className="text-xs font-semibold" style={{ color: GOLD }}>
            Compliance Workflow
          </span>
        </div>
        <div className="flex items-center gap-0 overflow-x-auto pb-1">
          {departments.map((dept, idx) => (
            <div key={dept} className="flex items-center shrink-0">
              {/* Node */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.08 }}
                className="chamber-card-inner px-3 py-2 text-center shrink-0"
                style={{
                  background: OBSIDIAN_2,
                  border: `1px solid ${OBSIDIAN_3}`,
                  minWidth: 90,
                }}
              >
                <Building size={11} style={{ color: GOLD }} className="mx-auto mb-1" />
                <p
                  className="text-[10px] font-medium leading-tight"
                  style={{ color: '#E5E5E5', maxWidth: 80 }}
                >
                  {dept.length > 18 ? dept.slice(0, 16) + '…' : dept}
                </p>
              </motion.div>
              {/* Flow edge between nodes */}
              {idx < departments.length - 1 && (
                <div className="flow-edge mx-1" style={{ minWidth: 32 }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  );
}

// ─── No-case landing page ─────────────────────────────────────────────────────
function VerificationLanding() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['cases'],
    queryFn: listCases,
    refetchInterval: 15_000,
  });

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
  });

  const pending = cases.filter(c => c.status === 'pending');
  const verified = cases.filter(c => c.status === 'verified');

  const filtered = cases.filter(c =>
    !search ||
    c.case_number.toLowerCase().includes(search.toLowerCase()) ||
    c.court.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">Verification</h1>
        <p className="text-sm text-[#64748B] mt-0.5">Select a case below to begin reviewing directives</p>
      </motion.div>

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-3 gap-4"
      >
        {[
          {
            icon: FileText,
            label: 'Total Cases',
            value: cases.length,
            color: GOLD,
            sub: 'uploaded judgments',
          },
          {
            icon: Clock,
            label: 'Awaiting Review',
            value: stats?.pending_directives ?? 0,
            color: '#F59E0B',
            sub: 'pending directives',
          },
          {
            icon: CheckCircle,
            label: 'Fully Verified',
            value: verified.length,
            color: SUCCESS,
            sub: 'completed cases',
          },
        ].map(({ icon: Icon, label, value, color, sub }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + i * 0.06 }}
            className="chamber-card p-5"
            style={{ background: OBSIDIAN, border: `1px solid ${OBSIDIAN_3}` }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl" style={{ background: `${color}18` }}>
                <Icon size={16} style={{ color }} />
              </div>
              <span className="text-xs font-medium" style={{ color: '#A3A3A3' }}>{label}</span>
            </div>
            <p className="text-3xl font-extrabold text-white">{value}</p>
            <p className="text-[11px] mt-0.5" style={{ color: '#4A4A4A' }}>{sub}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Pending cases — priority section */}
      {pending.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="chamber-card overflow-hidden"
          style={{ background: OBSIDIAN, border: `1px solid ${GOLD}30` }}
        >
          {/* Gold shimmer top border */}
          <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
          <div className="px-5 py-4 border-b" style={{ borderColor: OBSIDIAN_3 }}>
            <div className="flex items-center gap-2">
              <Zap size={14} style={{ color: GOLD }} />
              <h3 className="text-sm font-semibold text-white">Needs Your Attention</h3>
              <span className="ml-auto gold-badge">{pending.length} pending</span>
            </div>
          </div>
          <div className="divide-y" style={{ borderColor: OBSIDIAN_3 }}>
            {pending.map((c, i) => {
              const pendingDirs = c.directives?.filter(d => d.status === 'pending').length || 0;
              const totalDirs = c.directives?.length || 0;
              const progress = totalDirs > 0 ? Math.round(((totalDirs - pendingDirs) / totalDirs) * 100) : 0;
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.05 }}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-[#111111] transition-colors cursor-pointer group"
                  onClick={() => navigate(`/verify/${c.id}`)}
                >
                  {/* Status dot */}
                  <div className="w-2 h-2 rounded-full shrink-0 status-dot" style={{ background: GOLD }} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-white truncate">{c.case_number}</p>
                      <span className="badge text-[10px]"
                        style={{ background: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}30` }}>
                        {c.judgment_type || 'Directive'}
                      </span>
                    </div>
                    <p className="text-xs truncate" style={{ color: '#A3A3A3' }}>{c.court}</p>
                    {totalDirs > 0 && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="w-24 progress-bar-track" style={{ height: 3 }}>
                          <div className="progress-bar-fill" style={{ width: `${progress}%`, height: '100%' }} />
                        </div>
                        <span className="text-[10px]" style={{ color: '#4A4A4A' }}>
                          {totalDirs - pendingDirs}/{totalDirs} done
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs" style={{ color: '#A3A3A3' }}>
                      {c.judgment_date ? format(new Date(c.judgment_date), 'dd MMM yyyy') : '—'}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#F59E0B' }}>
                      {pendingDirs} directive{pendingDirs !== 1 ? 's' : ''} pending
                    </p>
                  </div>

                  <div
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all group-hover:shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${GOLD}, #B49450)`, color: OBSIDIAN }}
                  >
                    Review <ChevronRight size={12} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* All cases searchable list */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="chamber-card overflow-hidden"
        style={{ background: OBSIDIAN, border: `1px solid ${OBSIDIAN_3}` }}
      >
        <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: OBSIDIAN_3 }}>
          <Scale size={14} style={{ color: GOLD }} />
          <h3 className="text-sm font-semibold text-white">All Cases</h3>
          {/* Search */}
          <div className="relative ml-auto">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#4A4A4A' }} />
            <input
              type="text"
              placeholder="Search cases…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-7 pr-3 py-1.5 text-xs rounded-lg outline-none text-white w-48"
              style={{ background: OBSIDIAN_2, border: `1px solid ${OBSIDIAN_3}` }}
              onFocus={e => { e.target.style.borderColor = GOLD; }}
              onBlur={e => { e.target.style.borderColor = OBSIDIAN_3; }}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton h-12 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <FolderOpen size={32} style={{ color: '#2A2A2A' }} className="mx-auto mb-3" />
            <p className="text-sm font-medium" style={{ color: '#A3A3A3' }}>
              {cases.length === 0 ? 'No cases uploaded yet' : 'No cases match your search'}
            </p>
            {cases.length === 0 && (
              <Link to="/upload" className="btn-gold text-xs mt-4 inline-flex">
                <Upload size={13} /> Upload First Case
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: OBSIDIAN_3 }}>
            {filtered.map((c, i) => {
              const pendingDirs = c.directives?.filter(d => d.status === 'pending').length || 0;
              const totalDirs = c.directives?.length || 0;
              const isVerified = c.status === 'verified';
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#111111] transition-colors cursor-pointer group"
                  onClick={() => navigate(`/verify/${c.id}`)}
                >
                  <div className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: isVerified ? SUCCESS : GOLD }} />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{c.case_number}</p>
                    <p className="text-xs truncate" style={{ color: '#4A4A4A' }}>{c.court}</p>
                  </div>

                  <span className={`badge text-[10px] shrink-0 ${
                    isVerified
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  }`}>
                    {isVerified ? '✓ Verified' : `${pendingDirs} pending`}
                  </span>

                  <span className="text-xs shrink-0" style={{ color: '#4A4A4A' }}>
                    {totalDirs} directive{totalDirs !== 1 ? 's' : ''}
                  </span>

                  <ChevronRight size={14} style={{ color: '#2A2A2A' }}
                    className="shrink-0 group-hover:text-[#D4AF37] transition-colors" />
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Empty state — no cases at all */}
      {!isLoading && cases.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="chamber-card p-16 text-center"
          style={{ background: OBSIDIAN, border: `1px solid ${OBSIDIAN_3}` }}
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-block p-5 rounded-2xl mb-5"
            style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}20` }}
          >
            <Shield size={36} style={{ color: GOLD }} />
          </motion.div>
          <h2 className="text-lg font-bold text-white mb-2">No Cases to Verify</h2>
          <p className="text-sm mb-6" style={{ color: '#A3A3A3' }}>
            Upload a court judgment PDF to extract directives and begin the verification workflow.
          </p>
          <Link to="/upload" className="btn-gold">
            <Upload size={14} /> Upload Judgment
          </Link>
        </motion.div>
      )}
    </div>
  );
}
function LoadingSkeleton() {
  return (
    <div className="flex gap-4 h-[calc(100vh-130px)]">
      {/* Left: PDF skeleton */}
      <div className="w-1/2 chamber-card p-4 flex flex-col gap-3">
        <div className="skeleton h-5 w-40" />
        <div className="skeleton flex-1 rounded-xl" />
      </div>
      {/* Right: directives skeleton */}
      <div className="w-1/2 flex flex-col gap-3">
        <div className="chamber-card p-5">
          <div className="skeleton h-5 w-48 mb-3" />
          <div className="skeleton h-3 w-32 mb-2" />
          <div className="skeleton h-2 w-full" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="chamber-card p-4">
            <div className="skeleton h-4 w-3/4 mb-2" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Verify page ─────────────────────────────────────────────────────────
export default function Verify() {
  const { caseId } = useParams();

  // No case selected — show the landing page
  if (!caseId) return <VerificationLanding />;

  return <VerifyCase caseId={caseId} />;
}

// ─── Actual case verification view ───────────────────────────────────────────
function VerifyCase({ caseId }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { filters, selectedDirectives, clearSelection, addNotification } = useAppStore();

  const [summaryOpen, setSummaryOpen] = useState(false);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'timeline'

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: caseData, isLoading, isError } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => getCase(caseId),
    enabled: !!caseId,
  });

  // ── Verify single directive ────────────────────────────────────────────────
  const verifyMutation = useMutation({
    mutationFn: ({ id, action, notes }) =>
      verifyDirective(id, { action, notes, officer_name: 'Justice Sharma' }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      addNotification({
        type: variables.action === 'approve' ? 'success' : 'warning',
        title: `Directive ${variables.action === 'approve' ? 'Approved' : 'Rejected'}`,
        message: `Directive has been ${variables.action}d by Justice Sharma.`,
      });
      toast.success(
        variables.action === 'approve' ? '✓ Directive approved' : '✗ Directive rejected'
      );
    },
    onError: () => toast.error('Failed to update directive'),
  });

  // ── Batch verify ───────────────────────────────────────────────────────────
  const batchMutation = useMutation({
    mutationFn: ({ ids, action }) =>
      Promise.all(
        ids.map((id) =>
          verifyDirective(id, { action, notes: 'Batch action', officer_name: 'Justice Sharma' })
        )
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      clearSelection();
      addNotification({
        type: 'success',
        title: 'Batch Action Complete',
        message: `${variables.ids.length} directives ${variables.action}d.`,
      });
      toast.success(`${variables.ids.length} directives ${variables.action}d`);
    },
    onError: () => toast.error('Batch action failed'),
  });

  // ── Derived data ───────────────────────────────────────────────────────────
  const directives = caseData?.directives ?? [];
  const total = directives.length;
  const approved = directives.filter((d) => d.status === 'approved').length;
  const pending = directives.filter((d) => d.status === 'pending').length;
  const progress = total > 0 ? Math.round((approved / total) * 100) : 0;
  const allVerified = total > 0 && pending === 0;

  const departments = [...new Set(directives.map((d) => d.responsible_department).filter(Boolean))];

  // ── Filtered directives ────────────────────────────────────────────────────
  const filtered = directives.filter((d) => {
    if (filters.status && d.status !== filters.status) return false;
    if (filters.priority && d.priority !== filters.priority) return false;
    if (filters.department && d.responsible_department !== filters.department) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (
        !d.directive_text?.toLowerCase().includes(q) &&
        !d.responsible_department?.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  // ── Timeline grouping ──────────────────────────────────────────────────────
  const timelineGroups = filtered.reduce((acc, d) => {
    const cat = d.workflow_category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(d);
    return acc;
  }, {});

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleVerify = (id, action, notes) =>
    verifyMutation.mutateAsync({ id, action, notes });

  const handleBatchApprove = () => {
    const ids = [...selectedDirectives];
    if (!ids.length) return;
    batchMutation.mutate({ ids, action: 'approve' });
  };

  const handleBatchReject = () => {
    const ids = [...selectedDirectives];
    if (!ids.length) return;
    batchMutation.mutate({ ids, action: 'reject' });
  };

  // ── Legal takeaway guard ───────────────────────────────────────────────────
  const rawTakeaway = caseData?.key_legal_takeaway ?? '';
  const showTakeaway = rawTakeaway && !rawTakeaway.startsWith('{');

  // ── Render states ──────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="p-6">
      <LoadingSkeleton />
    </div>
  );

  if (isError || !caseData) return (
    <div className="p-6">
      <div
        className="chamber-card p-16 text-center"
        style={{ background: OBSIDIAN, border: `1px solid ${OBSIDIAN_3}` }}
      >
        <AlertTriangle size={40} style={{ color: '#EF4444' }} className="mx-auto mb-3" />
        <p className="text-white font-semibold text-lg mb-1">Case Not Found</p>
        <p className="text-[#A3A3A3] text-sm mb-6">
          The case with ID <span className="font-mono text-[#D4AF37]">{caseId}</span> could not be loaded.
        </p>
        <button onClick={() => navigate('/cases')} className="btn-gold">
          <ArrowLeft size={14} /> Back to Cases
        </button>
      </div>
    </div>
  );

  const parties =
    caseData.parties_petitioner && caseData.parties_respondent
      ? `${caseData.parties_petitioner} v. ${caseData.parties_respondent}`
      : caseData.parties_petitioner || caseData.parties_respondent || '—';

  return (
    <div className="flex flex-col h-full">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-6 py-3 border-b shrink-0"
        style={{ borderColor: '#E2E8F0', background: '#FFFFFF' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/cases')}
            className="btn-ghost"
            style={{ padding: '0.4rem 0.75rem' }}
          >
            <ArrowLeft size={14} /> Cases
          </button>
          <span style={{ color: '#E2E8F0' }}>›</span>
          <span className="text-sm font-semibold text-[#0F172A]">
            {caseData.case_number}
          </span>
          {allVerified && (
            <span className="gold-badge">
              <CheckCheck size={11} /> All Verified
            </span>
          )}
        </div>
        <ExportMenu caseData={caseData} />
      </div>

      {/* ── Two-panel layout ─────────────────────────────────────────────────── */}
      <div className="flex gap-4 px-6 py-4 h-[calc(100vh-130px)]">

        {/* ── LEFT: PDF viewer ─────────────────────────────────────────────── */}
        <div className="w-1/2 flex flex-col">
          <div
            className="chamber-card flex flex-col h-full overflow-hidden"
            style={{ background: OBSIDIAN, border: `1px solid ${OBSIDIAN_3}` }}
          >
            {/* Panel header */}
            <div
              className="flex items-center gap-2 px-4 py-3 border-b shrink-0"
              style={{ borderColor: OBSIDIAN_3 }}
            >
              <Scale size={13} style={{ color: GOLD }} />
              <span className="text-xs font-semibold" style={{ color: GOLD }}>
                Judgment Document
              </span>
              <span className="ml-auto text-[10px]" style={{ color: '#4A4A4A' }}>
                {caseData.case_number}
              </span>
            </div>
            {/* PDF iframe */}
            <iframe
              src={`${API_URL}/cases/${caseId}/pdf`}
              title="Judgment PDF"
              className="flex-1 w-full"
              style={{ border: 'none', background: '#1A1A1A' }}
            />
          </div>
        </div>

        {/* ── RIGHT: Directives panel ──────────────────────────────────────── */}
        <div className="w-1/2 overflow-y-auto flex flex-col gap-4 pr-1">

          {/* Case identity card */}
          <Reveal>
            <div
              className="chamber-card p-5"
              style={{ background: OBSIDIAN, border: `1px solid ${OBSIDIAN_3}` }}
            >
              {/* Case number + court */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-base font-bold text-white leading-tight">
                    {caseData.case_number}
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: '#A3A3A3' }}>
                    {caseData.court}
                  </p>
                </div>
                <span className="gold-badge shrink-0">
                  {caseData.judgment_type || 'Directive'}
                </span>
              </div>

              {/* Parties */}
              {parties !== '—' && (
                <p className="text-xs mb-3 leading-relaxed" style={{ color: '#A3A3A3' }}>
                  <span style={{ color: GOLD }} className="font-medium">Parties: </span>
                  {parties}
                </p>
              )}

              {/* Judgment date */}
              {caseData.judgment_date && (
                <div className="flex items-center gap-1.5 mb-3 text-xs" style={{ color: '#A3A3A3' }}>
                  <Calendar size={11} style={{ color: GOLD }} />
                  {format(new Date(caseData.judgment_date), 'dd MMMM yyyy')}
                </div>
              )}

              {/* Progress bar */}
              <div className="mb-3">
                <div className="flex justify-between text-[10px] mb-1" style={{ color: '#4A4A4A' }}>
                  <span>Verification Progress</span>
                  <span style={{ color: GOLD }}>{progress}%</span>
                </div>
                <div className="progress-bar-track">
                  <motion.div
                    className="progress-bar-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                  />
                </div>
              </div>

              {/* Mini stats */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Total', value: total, color: '#E5E5E5' },
                  { label: 'Approved', value: approved, color: SUCCESS },
                  { label: 'Pending', value: pending, color: WARNING },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="chamber-card-inner p-2.5 text-center"
                    style={{ background: OBSIDIAN_2, border: `1px solid ${OBSIDIAN_3}` }}
                  >
                    <p className="text-lg font-bold" style={{ color }}>{value}</p>
                    <p className="text-[10px]" style={{ color: '#4A4A4A' }}>{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* AI Summary collapsible */}
          {caseData.ai_summary && (
            <Reveal delay={0.05}>
              <div
                className="chamber-card overflow-hidden"
                style={{ background: OBSIDIAN, border: `1px solid ${OBSIDIAN_3}` }}
              >
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                  onClick={() => setSummaryOpen((v) => !v)}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles size={13} style={{ color: GOLD }} />
                    <span className="text-xs font-semibold" style={{ color: GOLD }}>
                      AI Summary
                    </span>
                  </div>
                  {summaryOpen
                    ? <ChevronUp size={13} style={{ color: '#4A4A4A' }} />
                    : <ChevronDown size={13} style={{ color: '#4A4A4A' }} />
                  }
                </button>
                <AnimatePresence initial={false}>
                  {summaryOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <div
                        className="px-4 pb-4 pt-1 text-xs leading-relaxed border-t"
                        style={{ color: '#A3A3A3', borderColor: OBSIDIAN_3 }}
                      >
                        {caseData.ai_summary}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
          )}

          {/* Legal Takeaway */}
          {showTakeaway && (
            <Reveal delay={0.08}>
              <div
                className="chamber-card p-4"
                style={{
                  background: OBSIDIAN,
                  border: `1px solid ${OBSIDIAN_3}`,
                  borderLeft: `3px solid ${GOLD}`,
                }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: GOLD }}>
                  Key Legal Takeaway
                </p>
                <p className="text-xs leading-relaxed" style={{ color: '#A3A3A3' }}>
                  {rawTakeaway}
                </p>
              </div>
            </Reveal>
          )}

          {/* Dept Impact */}
          {caseData.dept_impact && (
            <Reveal delay={0.1}>
              <div
                className="chamber-card p-4"
                style={{
                  background: OBSIDIAN,
                  border: `1px solid ${OBSIDIAN_3}`,
                  borderLeft: `3px solid ${GOLD}`,
                }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: GOLD }}>
                  Departmental Impact
                </p>
                <p className="text-xs leading-relaxed" style={{ color: '#A3A3A3' }}>
                  {caseData.dept_impact}
                </p>
              </div>
            </Reveal>
          )}

          {/* Workflow graph */}
          <WorkflowGraph departments={departments} />

          {/* View toggle */}
          <Reveal delay={0.12}>
            <div className="flex items-center gap-2">
              {[
                { id: 'cards', icon: <LayoutList size={12} />, label: 'Cards' },
                { id: 'timeline', icon: <Clock size={12} />, label: 'Timeline' },
              ].map(({ id, icon, label }) => (
                <button
                  key={id}
                  onClick={() => setViewMode(id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={
                    viewMode === id
                      ? { background: GOLD, color: OBSIDIAN, fontWeight: 600 }
                      : { background: OBSIDIAN_2, color: '#A3A3A3', border: `1px solid ${OBSIDIAN_3}` }
                  }
                >
                  {icon} {label}
                </button>
              ))}
              <span className="ml-auto text-[10px]" style={{ color: '#4A4A4A' }}>
                {filtered.length} directive{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>
          </Reveal>

          {/* FilterBar */}
          <FilterBar departments={departments} />

          {/* BatchActionBar */}
          <AnimatePresence>
            {selectedDirectives.size > 0 && (
              <BatchActionBar
                selectedCount={selectedDirectives.size}
                onApprove={handleBatchApprove}
                onReject={handleBatchReject}
                onClear={clearSelection}
              />
            )}
          </AnimatePresence>

          {/* ── Cards view ─────────────────────────────────────────────────── */}
          {viewMode === 'cards' && (
            <AnimatePresence mode="popLayout">
              {filtered.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="chamber-card p-10 text-center"
                  style={{ background: OBSIDIAN, border: `1px solid ${OBSIDIAN_3}` }}
                >
                  <p className="text-sm" style={{ color: '#A3A3A3' }}>No directives match the current filters.</p>
                </motion.div>
              ) : (
                filtered.map((directive) => (
                  <DirectiveCard
                    key={directive.id}
                    directive={directive}
                    onVerify={handleVerify}
                    isVerifying={verifyMutation.isPending}
                  />
                ))
              )}
            </AnimatePresence>
          )}

          {/* ── Timeline view ───────────────────────────────────────────────── */}
          {viewMode === 'timeline' && (
            <div className="space-y-6">
              {Object.entries(timelineGroups).map(([category, items], groupIdx) => (
                <Reveal key={category} delay={groupIdx * 0.06}>
                  <div>
                    {/* Category heading */}
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
                        style={{ background: `${GOLD}20`, color: GOLD, border: `1px solid ${GOLD}40` }}
                      >
                        {category}
                      </span>
                      <span className="text-[10px]" style={{ color: '#4A4A4A' }}>
                        {items.length} directive{items.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Timeline items */}
                    <div className="relative pl-8">
                      {/* Vertical line */}
                      <div className="timeline-line" />

                      <div className="space-y-4">
                        {items.map((directive, idx) => {
                          const isPending = directive.status === 'pending';
                          return (
                            <div key={directive.id} className="relative">
                              {/* Timeline dot */}
                              <div
                                className="timeline-dot"
                                style={{
                                  top: 14,
                                  background: isPending ? GOLD : SUCCESS,
                                  boxShadow: isPending
                                    ? `0 0 0 3px ${GOLD}30`
                                    : `0 0 0 3px ${SUCCESS}30`,
                                }}
                              />
                              <DirectiveCard
                                directive={directive}
                                onVerify={handleVerify}
                                isVerifying={verifyMutation.isPending}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}

              {filtered.length === 0 && (
                <div
                  className="chamber-card p-10 text-center"
                  style={{ background: OBSIDIAN, border: `1px solid ${OBSIDIAN_3}` }}
                >
                  <p className="text-sm" style={{ color: '#A3A3A3' }}>No directives match the current filters.</p>
                </div>
              )}
            </div>
          )}

          {/* All-verified banner */}
          <AnimatePresence>
            {allVerified && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="chamber-card p-6 text-center"
                style={{
                  background: `linear-gradient(135deg, ${OBSIDIAN} 0%, #0D1A0D 100%)`,
                  border: `1px solid ${SUCCESS}40`,
                  boxShadow: `0 0 24px ${SUCCESS}15`,
                }}
              >
                <CheckCircle size={32} style={{ color: SUCCESS }} className="mx-auto mb-2" />
                <p className="text-sm font-bold text-white mb-1">All Directives Verified</p>
                <p className="text-xs" style={{ color: '#A3A3A3' }}>
                  {approved} directive{approved !== 1 ? 's' : ''} reviewed for{' '}
                  <span style={{ color: GOLD }}>{caseData.case_number}</span>
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom padding */}
          <div className="h-6 shrink-0" />
        </div>
      </div>
    </div>
  );
}
