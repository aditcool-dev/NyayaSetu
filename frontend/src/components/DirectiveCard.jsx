import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Clock, AlertTriangle, ChevronDown, FileText, User, Calendar, Building, Edit3, Zap, Save, X } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useAppStore } from '../stores/appStore';
import { useLanguage } from '../i18n/LanguageContext';

const GOLD    = '#D4AF37';
const OBSIDIAN  = '#0D0D0D';
const OBSIDIAN_2 = '#1A1A1A';
const OBSIDIAN_3 = '#2A2A2A';
const SUCCESS = '#10B981';
const WARNING = '#F59E0B';
const RUBY    = '#EF4444';

const priorityConfig = {
  High:   { bg: 'rgba(239,68,68,0.12)',   text: '#EF4444', border: 'rgba(239,68,68,0.3)' },
  Medium: { bg: 'rgba(245,158,11,0.12)',  text: '#F59E0B', border: 'rgba(245,158,11,0.3)' },
  Low:    { bg: 'rgba(16,185,129,0.12)',  text: '#10B981', border: 'rgba(16,185,129,0.3)' },
};

const statusConfig = {
  pending:  { bg: 'rgba(163,163,163,0.1)', text: '#A3A3A3', border: 'rgba(163,163,163,0.2)' },
  approved: { bg: 'rgba(16,185,129,0.12)', text: '#10B981', border: 'rgba(16,185,129,0.3)' },
  rejected: { bg: 'rgba(239,68,68,0.12)',  text: '#EF4444', border: 'rgba(239,68,68,0.3)' },
};

function ConfidenceRing({ score, size = 32, sw = 2.5 }) {
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const color = score >= 0.9 ? SUCCESS : score >= 0.8 ? GOLD : WARNING;
  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg style={{ transform: 'rotate(-90deg)' }} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={OBSIDIAN_3} strokeWidth={sw} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - score * c }}
          transition={{ duration: 1, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
        />
      </svg>
      <span className="absolute text-[9px] font-bold" style={{ color }}>{Math.round(score * 100)}</span>
    </div>
  );
}

function DeadlineChip({ deadline }) {
  const { t } = useLanguage();
  if (!deadline) return null;
  const days = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 0) return (
    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: RUBY }}>
      <AlertTriangle size={10} /> {t('dir_overdue')}
    </span>
  );
  if (days < 7) return (
    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: WARNING }}>
      <Clock size={10} /> {days}{t('dir_days_left')}
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs" style={{ color: SUCCESS }}>
      <Calendar size={10} /> {days}{t('dir_days_left')}
    </span>
  );
}

export default function DirectiveCard({ directive, onVerify, isVerifying, onPageJump }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState('');
  const [localVerifying, setLocalVerifying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(directive.directive_text);
  const { selectedDirectives, toggleDirectiveSelection } = useAppStore();
  const isSelected = selectedDirectives.has(directive.id);

  const handleVerify = async (action) => {
    setLocalVerifying(true);
    try {
      await onVerify(directive.id, action, notes);
      setNotes('');
    } finally {
      setLocalVerifying(false);
    }
  };

  const busy = localVerifying || isVerifying;
  const pCfg = priorityConfig[directive.priority] || priorityConfig.Medium;
  const sCfg = statusConfig[directive.status] || statusConfig.pending;

  // Translated priority/status labels
  const priorityLabel = { High: t('dir_high'), Medium: t('dir_medium'), Low: t('dir_low') }[directive.priority] || directive.priority;
  const statusLabel = { pending: t('dir_pending'), approved: t('dir_approved'), rejected: t('dir_rejected') }[directive.status] || directive.status;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: OBSIDIAN,
        border: `2px solid ${isSelected ? GOLD : OBSIDIAN_3}`,
        boxShadow: isSelected ? `0 0 0 2px ${GOLD}30` : 'none',
        opacity: directive.status !== 'pending' ? 0.75 : 1,
      }}
    >
      {/* ── Header ── */}
      <div
        className="p-4 cursor-pointer select-none hover:bg-[#111111] transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={e => { e.stopPropagation(); toggleDirectiveSelection(directive.id); }}
            onClick={e => e.stopPropagation()}
            className="mt-1 w-3.5 h-3.5 rounded shrink-0"
            style={{ accentColor: GOLD }}
          />

          {/* Confidence ring */}
          <ConfidenceRing score={directive.confidence_score || 0.8} />

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              <span className="badge text-[10px]" style={{ background: pCfg.bg, color: pCfg.text, border: `1px solid ${pCfg.border}` }}>{priorityLabel}</span>
              <span className="badge text-[10px]" style={{ background: sCfg.bg, color: sCfg.text, border: `1px solid ${sCfg.border}` }}>{statusLabel}</span>
              <span className="badge text-[10px]"
                style={{ background: 'rgba(139,92,246,0.12)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.3)' }}>
                {directive.directive_type}
              </span>
              {directive.confidence_score && (
                <span className="badge text-[10px]"
                  style={{ background: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}30` }}>
                  {Math.round(directive.confidence_score * 100)}% conf.
                </span>
              )}
            </div>

            {/* Directive text */}
            <p className="text-sm font-medium text-white leading-snug">
              {directive.directive_text || directive.source_text || "[No directive text available]"}
            </p>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs" style={{ color: '#A3A3A3' }}>
              <span className="flex items-center gap-1">
                <Building size={10} style={{ color: GOLD }} /> {directive.responsible_department}
              </span>
              <DeadlineChip deadline={directive.deadline} />
              <button
                className="flex items-center gap-1 transition-colors hover:text-white"
                style={{ color: '#A3A3A3' }}
                onClick={e => { e.stopPropagation(); onPageJump?.(directive.source_page); }}
              >
                <FileText size={10} style={{ color: GOLD }} /> p.{directive.source_page}
              </button>
            </div>
          </div>

          {/* Quick action buttons (visible on hover) */}
          {directive.status === 'pending' && (
            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => handleVerify('approve')}
                disabled={busy}
                title="Approve"
                className="p-1.5 rounded-lg transition-colors disabled:opacity-40"
                style={{ background: 'rgba(16,185,129,0.12)', color: SUCCESS }}
              >
                <CheckCircle size={15} />
              </button>
              <button
                onClick={() => handleVerify('reject')}
                disabled={busy}
                title="Reject"
                className="p-1.5 rounded-lg transition-colors disabled:opacity-40"
                style={{ background: 'rgba(239,68,68,0.12)', color: RUBY }}
              >
                <XCircle size={15} />
              </button>
            </div>
          )}

          {/* Expand chevron */}
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={14} style={{ color: '#4A4A4A' }} className="shrink-0" />
          </motion.div>
        </div>
      </div>

      {/* ── Expanded ── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t pt-3" style={{ borderColor: OBSIDIAN_3 }}>

              {/* Trigger condition */}
              {directive.trigger_condition && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg text-xs"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: WARNING }}>
                  <Zap size={11} className="mt-0.5 shrink-0" />
                  <span><strong>{t('dir_trigger')}:</strong> {directive.trigger_condition}</span>
                </div>
              )}

              {/* Source text */}
              <div className="p-3 rounded-lg" style={{ background: OBSIDIAN_2, border: `1px solid ${OBSIDIAN_3}` }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: GOLD }}>
                  📄 {t('dir_source')} — {t('dir_source_page')} {directive.source_page}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: '#A3A3A3' }}>
                  {directive.source_text && directive.source_text.length > 10 
                    ? `"${directive.source_text}"`
                    : directive.directive_text 
                      ? `"${directive.directive_text}"`
                      : "[Source text not available]"
                  }
                </p>
              </div>

              {/* Audit log */}
              {directive.audit_logs?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#4A4A4A' }}>
                    📋 {t('dir_audit_trail')}
                  </p>
                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {directive.audit_logs.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2 rounded-lg text-xs"
                        style={{ background: OBSIDIAN_2 }}>
                        <User size={11} style={{ color: '#4A4A4A' }} className="mt-0.5 shrink-0" />
                        <div>
                          <span className="font-medium text-white">{log.officer_name}</span>
                          <span style={{ color: '#A3A3A3' }}> {log.action} </span>
                          <span style={{ color: '#4A4A4A' }}>
                            {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                          </span>
                          {log.notes && <p className="mt-0.5" style={{ color: '#A3A3A3' }}>Note: {log.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {[
                  { labelKey: 'dir_workflow',     value: directive.workflow_category || t('common_general') },
                  { labelKey: 'dir_source_page',  value: directive.source_page },
                  { labelKey: 'dir_created',      value: format(new Date(directive.created_at), 'dd MMM yyyy') },
                  { labelKey: 'dir_deadline',     value: directive.deadline ? format(new Date(directive.deadline), 'dd MMM yyyy') : t('dir_none') },
                ].map(({ labelKey, value }) => (
                  <div key={labelKey} className="p-2 rounded-lg" style={{ background: OBSIDIAN_2 }}>
                    <p className="text-[10px]" style={{ color: '#4A4A4A' }}>{t(labelKey)}</p>
                    <p className="text-xs font-medium text-white mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              {/* Actions for pending */}
              {directive.status === 'pending' && (
                <div className="space-y-2 pt-1">
                  {/* Inline edit */}
                  {isEditing && (
                    <textarea
                      value={editedText}
                      onChange={e => setEditedText(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      rows={3}
                      className="w-full px-3 py-2 text-xs rounded-xl text-white outline-none resize-none"
                      style={{ background: OBSIDIAN_2, border: `1px solid ${GOLD}` }}
                    />
                  )}

                  <textarea
                    placeholder={t('dir_notes_placeholder')}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    rows={2}
                    className="w-full px-3 py-2 text-xs rounded-xl text-white outline-none resize-none"
                    style={{ background: OBSIDIAN_2, border: `1px solid ${OBSIDIAN_3}` }}
                    onFocus={e => { e.target.style.borderColor = GOLD; }}
                    onBlur={e => { e.target.style.borderColor = OBSIDIAN_3; }}
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={e => { e.stopPropagation(); handleVerify('approve'); }}
                      disabled={busy}
                      className="flex-1 py-2 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-40"
                      style={{ background: 'rgba(16,185,129,0.15)', color: SUCCESS, border: `1px solid rgba(16,185,129,0.3)` }}
                    >
                      <CheckCircle size={13} /> Approve
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleVerify('reject'); }}
                      disabled={busy}
                      className="flex-1 py-2 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-40"
                      style={{ background: 'rgba(239,68,68,0.15)', color: RUBY, border: `1px solid rgba(239,68,68,0.3)` }}
                    >
                      <XCircle size={13} /> Reject
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setIsEditing(v => !v); }}
                      className="px-3 py-2 text-xs font-medium rounded-xl transition flex items-center gap-1.5"
                      style={isEditing
                        ? { background: `${GOLD}20`, color: GOLD, border: `1px solid ${GOLD}40` }
                        : { background: 'rgba(139,92,246,0.12)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.3)' }}
                    >
                      {isEditing ? <><Save size={12} /> Save</> : <><Edit3 size={12} /> Edit</>}
                    </button>
                  </div>
                </div>
              )}

              {/* Already actioned */}
              {directive.status !== 'pending' && (
                <div className="flex justify-end">
                  <span className="badge text-xs font-medium"
                    style={directive.status === 'approved'
                      ? { background: 'rgba(16,185,129,0.12)', color: SUCCESS, border: `1px solid rgba(16,185,129,0.3)` }
                      : { background: 'rgba(239,68,68,0.12)', color: RUBY, border: `1px solid rgba(239,68,68,0.3)` }}>
                    {directive.status === 'approved' ? '✓ Approved' : '✗ Rejected'}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
