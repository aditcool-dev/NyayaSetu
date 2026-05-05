import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Check, X, Edit2, Zap, Target, Clock, ChevronDown, ChevronUp, ArrowRight, FileText, Users, ShieldCheck } from 'lucide-react';
import { getCase, verifyDirective } from '../services/api';

/* ── Confidence Ring ── */
function ConfidenceRing({ score, size = 34, sw = 2.5, delay = 0 }) {
  const r = (size - sw) / 2, c = 2 * Math.PI * r;
  const color = score >= 0.9 ? '#16A34A' : score >= 0.8 ? '#2563EB' : '#F59E0B';
  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="confidence-ring" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={sw} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - score * c }}
          transition={{ duration: 1, delay: delay + 0.3, ease: [0.4, 0, 0.2, 1] }} />
      </svg>
      <span className="absolute text-[9px] font-semibold" style={{ color }}>{Math.round(score * 100)}</span>
    </div>
  );
}

/* ── Countdown Timer ── */
function Countdown({ deadline }) {
  const [text, setText] = useState('');
  const [over, setOver] = useState(false);
  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const diff = new Date(deadline) - new Date();
      if (diff <= 0) { setOver(true); setText('Overdue'); return; }
      const d = Math.floor(diff / 864e5), h = Math.floor((diff % 864e5) / 36e5);
      setText(d > 0 ? `${d}d ${h}h` : `${h}h`);
    };
    tick(); const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [deadline]);
  if (!deadline) return <span className="text-[10px] text-ink-muted flex items-center gap-1"><Clock size={10} />No deadline</span>;
  return <span className={`text-[10px] font-medium flex items-center gap-1 ${over ? 'text-red-500' : 'text-amber-500'}`}><Clock size={10} />{text}</span>;
}

/* ══════════════════════════════════════════════
   ANIMATED WORKFLOW GRAPH
   Nodes build step-by-step, edges have flowing dots
   ══════════════════════════════════════════════ */
function WorkflowGraph({ directives }) {
  const depts = [...new Set(directives.map(d => d.responsible_department))];
  if (depts.length <= 1) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
      className="card p-5 mb-3">
      <div className="flex items-center gap-2 mb-4">
        <Users size={14} className="text-brand" />
        <h4 className="text-xs font-semibold text-ink">Department Workflow</h4>
        <div className="flex-1" />
        <span className="badge bg-teal/6 text-teal border border-teal/10">
          <span className="w-1.5 h-1.5 bg-teal rounded-full status-dot" />
          Active
        </span>
      </div>
      <div className="flex items-center gap-0 px-2">
        {depts.map((dept, i) => (
          <div key={dept} className="flex items-center flex-1">
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.9 + i * 0.15, type: 'spring', stiffness: 300, damping: 20 }}
              whileHover={{ y: -3, boxShadow: '0 8px 20px rgba(37,99,235,0.1)' }}
              className="px-3 py-2.5 rounded-xl bg-white border border-border cursor-default shrink-0 z-10
                         hover:border-brand/20 transition-all"
            >
              <div className="text-center">
                <div className={`w-2 h-2 rounded-full mx-auto mb-1.5 ${i === 0 ? 'bg-brand' : i === depts.length - 1 ? 'bg-teal' : 'bg-amber-400'
                  }`} />
                <p className="text-[10px] font-medium text-ink whitespace-nowrap">{dept}</p>
              </div>
            </motion.div>
            {i < depts.length - 1 && (
              <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                transition={{ delay: 1.0 + i * 0.15, duration: 0.4 }}
                className="flow-edge origin-left mx-1.5" />
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Scroll Reveal ── */
function Reveal({ children, className = '', delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-20px' });
  return <motion.div ref={ref} initial={{ opacity: 0, y: 14 }}
    animate={inView ? { opacity: 1, y: 0 } : {}}
    transition={{ duration: 0.35, delay, ease: [0.4, 0, 0.2, 1] }}
    className={className}>{children}</motion.div>;
}

/* ══════════════════════════════════════════════
   VERIFY PAGE — Sequential Reveal Hero Experience
   ══════════════════════════════════════════════ */
export default function Verify() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [expanded, setExpanded] = useState({});

  useEffect(() => { getCase(caseId).then(d => { setCaseData(d); setLoading(false); }); }, [caseId]);

  const handleAction = async (directiveId, action) => {
    try {
      await verifyDirective(directiveId, { action, officer_name: 'Current User', notes: action === 'reject' ? 'Rejected' : '' });
      const updated = await getCase(caseId);
      setCaseData(updated);
      if (updated.status === 'verified') setTimeout(() => navigate('/'), 1500);
    } catch (e) { console.error(e); alert('Error'); }
  };

  const toggle = id => setExpanded(p => ({ ...p, [id]: !p[id] }));

  if (loading) return (
    <div className="w-full"><div className="flex gap-5 h-[calc(100vh-110px)]">
      <div className="w-1/2 card p-4"><div className="skeleton w-full h-full" /></div>
      <div className="w-1/2 space-y-3"><div className="card p-5"><div className="skeleton h-28" /></div></div>
    </div></div>
  );
  if (!caseData) return <div className="text-red-500 text-center py-10">Case not found.</div>;

  const grouped = caseData.directives.reduce((acc, d) => {
    const k = d.workflow_category || 'General Compliance';
    (acc[k] = acc[k] || []).push(d); return acc;
  }, {});
  const total = caseData.directives.length;
  const done = caseData.directives.filter(d => d.status !== 'pending').length;
  const progress = total > 0 ? (done / total) * 100 : 0;

  return (
    <div className="w-full">
      <div className="flex gap-5 h-[calc(100vh-110px)]">
        {/* ═══ LEFT: PDF ═══ */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}
          className="w-1/2 card p-0 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
            <FileText size={14} className="text-brand" />
            <span className="text-xs font-semibold text-ink-muted">Source Document</span>
            <div className="ml-auto"><span className="badge bg-surface text-ink-muted border border-border">PDF</span></div>
          </div>
          <div className="flex-1 bg-surface">
            <iframe src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/cases/${caseId}/pdf`} className="w-full h-full border-0" title="PDF" />
          </div>
        </motion.div>

        {/* ═══ RIGHT: AI Intelligence — Sequential Reveal ═══ */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}
          className="w-1/2 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">

            {/* ── 1. CASE IDENTITY (appears first, delay 0.2) ── */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}
              className="card p-5">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h2 className="text-lg font-bold text-ink tracking-tight">{caseData.case_number}</h2>
                  <p className="text-xs text-ink-muted mt-0.5">{caseData.court} • {new Date(caseData.judgment_date).toLocaleDateString()}</p>
                </div>
                <span className="badge bg-brand/6 text-brand border border-brand/10">{caseData.judgment_type || 'Directive'}</span>
              </div>
              <div className="flex gap-4 text-xs mb-3">
                <span><span className="text-brand font-medium">Petitioner:</span> <span className="text-ink-muted">{caseData.parties_petitioner}</span></span>
                <span><span className="text-teal font-medium">Respondent:</span> <span className="text-ink-muted">{caseData.parties_respondent}</span></span>
              </div>
              {total > 0 && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-ink-muted mb-1">
                    <span>Verification</span><span className="font-semibold text-ink">{done}/{total}</span>
                  </div>
                  <div className="progress-bar-track" style={{ height: 6 }}>
                    <motion.div className="progress-bar-fill" style={{ height: '100%' }}
                      initial={{ width: 0 }} animate={{ width: `${progress}%` }}
                      transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }} />
                  </div>
                </div>
              )}
            </motion.div>

            {/* ── 2. AI SUMMARY (appears second, delay 0.4) ── */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4 }}>
              <button onClick={() => setShowSummary(!showSummary)}
                className="w-full card text-left p-4 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-[10px] text-ink-muted uppercase tracking-wider font-semibold">AI Summary</h4>
                  <motion.div animate={{ rotate: showSummary ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown size={14} className="text-ink-faint" />
                  </motion.div>
                </div>
                <AnimatePresence initial={false}>
                  {showSummary
                    ? <motion.p key="f" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                      className="text-xs text-ink-light leading-relaxed overflow-hidden">{caseData.summary}</motion.p>
                    : <p className="text-xs text-ink-muted line-clamp-2 leading-relaxed">{caseData.summary}</p>}
                </AnimatePresence>
              </button>
            </motion.div>

            {/* ── 3. INSIGHTS (appears third, delay 0.6) ── */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.4 }}
              className="flex gap-2.5">
              {caseData.key_legal_takeaway && (
                <div className="flex-1 card p-3.5 border-l-[3px] border-l-brand">
                  <h4 className="text-[10px] text-brand font-semibold uppercase tracking-wider mb-1">Legal Takeaway</h4>
                  <p className="text-xs text-ink-muted leading-relaxed">{caseData.key_legal_takeaway}</p>
                </div>
              )}
              {caseData.impact_on_departments && (
                <div className="flex-1 card p-3.5 border-l-[3px] border-l-teal">
                  <h4 className="text-[10px] text-teal-dark font-semibold uppercase tracking-wider mb-1">Dept. Impact</h4>
                  <p className="text-xs text-ink-muted leading-relaxed">{caseData.impact_on_departments}</p>
                </div>
              )}
            </motion.div>

            {/* ── Empty state ── */}
            {total === 0 ? (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
                className="card p-10 text-center">
                <motion.div animate={{ scale: [1, 1.03, 1] }} transition={{ duration: 3, repeat: Infinity }}
                  className="inline-block p-4 rounded-2xl bg-emerald-50 border border-emerald-200 mb-3">
                  <ShieldCheck size={28} className="text-emerald-500" />
                </motion.div>
                <h3 className="text-sm font-bold text-ink mb-1">No Actionable Directives</h3>
                <p className="text-xs text-ink-muted">No enforceable compliance tasks found.</p>
              </motion.div>
            ) : (
              <>
                {/* ── 4. WORKFLOW GRAPH (appears fourth, delay 0.8) ── */}
                <WorkflowGraph directives={caseData.directives} />

                {/* ── 5. DIRECTIVE TIMELINE (appears fifth, delay 1.0+) ── */}
                {Object.entries(grouped).map(([category, dirs], catIdx) => (
                  <Reveal key={category} delay={0.05 * catIdx}>
                    <div className="flex items-center gap-2 mb-2">
                      <Target size={12} className="text-brand/60" />
                      <h4 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">{category}</h4>
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-ink-faint">{dirs.length}</span>
                    </div>

                    {/* Vertical Timeline */}
                    <div className="relative pl-9 space-y-2.5">
                      <div className="timeline-line" />
                      {dirs.map((dir, dIdx) => {
                        const isOpen = expanded[dir.id];
                        const dotColor = dir.status === 'approved' ? 'bg-emerald-500' :
                          dir.status === 'rejected' ? 'bg-red-500' : 'bg-brand';
                        return (
                          <motion.div key={dir.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 1.1 + catIdx * 0.1 + dIdx * 0.1, ease: [0.4, 0, 0.2, 1] }}
                            className={`relative ${dir.status !== 'pending' ? 'opacity-55' : ''}`}>
                            {/* Timeline dot */}
                            <div className={`timeline-dot ${dotColor}`} style={{ top: 18 }} />

                            {/* Expandable Card */}
                            <motion.div whileHover={dir.status === 'pending' ? { y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' } : {}}
                              className="card overflow-hidden">
                              <button onClick={() => toggle(dir.id)} className="w-full text-left p-4 hover:bg-surface/50 transition-colors">
                                <div className="flex items-start gap-3">
                                  <ConfidenceRing score={dir.confidence_score} size={32} sw={2} delay={1.0 + dIdx * 0.1} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-medium text-ink leading-snug pr-3">{dir.directive_text}</p>
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                      <span className="badge bg-surface text-ink-muted border border-border">{dir.responsible_department}</span>
                                      <span className="badge bg-brand/5 text-brand border border-brand/10">{dir.directive_type}</span>
                                      <span className={`badge border ${dir.priority === 'High' ? 'bg-red-50 text-red-600 border-red-200' :
                                          dir.priority === 'Medium' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                            'bg-emerald-50 text-emerald-600 border-emerald-200'
                                        }`}>{dir.priority}</span>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                                    <Countdown deadline={dir.deadline} />
                                    <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                      <ChevronDown size={12} className="text-ink-faint" />
                                    </motion.div>
                                  </div>
                                </div>
                              </button>

                              {/* ── Expanded Intelligence ── */}
                              <AnimatePresence initial={false}>
                                {isOpen && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                                    className="overflow-hidden">
                                    <div className="px-4 pb-4 space-y-2.5 border-t border-border pt-3">
                                      {dir.trigger_condition && (
                                        <div className="flex items-start gap-2 bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-xs text-amber-700">
                                          <Zap size={12} className="text-amber-500 mt-0.5 shrink-0" />
                                          <span><strong>Trigger:</strong> {dir.trigger_condition}</span>
                                        </div>
                                      )}
                                      <div className="bg-surface p-3 rounded-lg border border-border">
                                        <span className="block text-[10px] text-ink-faint uppercase tracking-wider font-medium mb-1">
                                          Source — Page {dir.source_page}
                                        </span>
                                        <p className="text-xs text-ink-muted italic leading-relaxed">"{dir.source_text}"</p>
                                      </div>
                                      <div className="flex items-center text-xs text-ink-muted gap-1.5">
                                        <Clock size={11} />
                                        <span>Deadline: </span>
                                        <span className="font-medium text-ink">
                                          {dir.deadline ? new Date(dir.deadline).toLocaleDateString() : 'Immediate'}
                                        </span>
                                      </div>
                                      {dir.status === 'pending' && (
                                        <div className="space-y-1.5 pt-1">
                                          <motion.button whileHover={{ scale: 1.005 }} whileTap={{ scale: 0.98 }}
                                            onClick={() => handleAction(dir.id, 'approve')}
                                            className="w-full py-2.5 btn-approve font-semibold rounded-xl text-xs flex items-center justify-center gap-2">
                                            <Check size={14} /> Approve Analysis
                                          </motion.button>
                                          <div className="flex gap-1.5">
                                            <motion.button whileHover={{ scale: 1.005 }} whileTap={{ scale: 0.98 }}
                                              className="flex-1 py-2 btn-edit font-medium rounded-xl text-xs flex items-center justify-center gap-1.5">
                                              <Edit2 size={12} /> Refine
                                            </motion.button>
                                            <motion.button whileHover={{ scale: 1.005 }} whileTap={{ scale: 0.98 }}
                                              onClick={() => handleAction(dir.id, 'reject')}
                                              className="flex-1 py-2 btn-reject font-medium rounded-xl text-xs flex items-center justify-center gap-1.5">
                                              <X size={12} /> Flag
                                            </motion.button>
                                          </div>
                                        </div>
                                      )}
                                      {dir.status !== 'pending' && (
                                        <div className="text-right">
                                          <span className={`badge text-xs font-medium ${dir.status === 'approved'
                                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                              : 'bg-red-50 text-red-600 border border-red-200'
                                            }`}>{dir.status === 'approved' ? '✓ Approved' : '✗ Flagged'}</span>
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </Reveal>
                ))}
              </>
            )}

            {total > 0 && caseData.status === 'verified' && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="card p-6 text-center border-emerald-200">
                <ShieldCheck size={22} className="text-emerald-500 mx-auto mb-2" />
                <p className="text-emerald-600 font-semibold text-sm">All directives verified!</p>
                <p className="text-emerald-400 text-xs mt-0.5">Redirecting to dashboard...</p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
