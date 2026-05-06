import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Sparkles, Shield, Zap, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadCase } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { useLanguage } from '../i18n/LanguageContext';

export default function Upload() {
  const { t } = useLanguage();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState(null);
  const stepTimerRef = useRef(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addNotification } = useAppStore();

  const STEPS = [
    { labelKey: 'upload_step1', icon: FileText },
    { labelKey: 'upload_step2', icon: Sparkles },
    { labelKey: 'upload_step3', icon: CheckCircle2 },
  ];

  const clearStepTimer = () => { if (stepTimerRef.current) clearTimeout(stepTimerRef.current); };

  const handleUpload = async () => {
    if (!file) return;
    setError(null); setLoading(true); setStep(1);
    stepTimerRef.current = setTimeout(() => setStep(2), 3000);
    try {
      const data = await uploadCase(file);
      clearStepTimer(); setStep(3);
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      addNotification({ title: t('upload_success_title'), message: `${data.case_number} — ${data.directives?.length || 0} directives extracted`, type: 'success' });
      toast.success(`${data.directives?.length || 0} directives extracted`);
      setTimeout(() => navigate(`/verify/${data.id}`), 900);
    } catch (err) {
      clearStepTimer(); setLoading(false); setStep(0);
      const msg = err?.response?.data?.detail || t('upload_failed');
      setError(msg); toast.error(msg);
      addNotification({ title: t('upload_fail_title'), message: msg, type: 'error' });
    }
  };

  const handleDragOver = useCallback((e) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);
  const handleDrop = useCallback((e) => {
    e.preventDefault(); setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === 'application/pdf') { setFile(f); setError(null); }
    else toast.error(t('upload_pdf_only'));
  }, [t]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">{t('upload_heading')}</h1>
        <p className="text-sm text-[#64748B] mt-0.5">{t('upload_subtitle')}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="chamber-card p-8" style={{ background: '#0D0D0D', border: '1px solid #2A2A2A' }}>

        <div className={`drop-zone p-14 text-center ${isDragOver || file ? 'active' : ''}`}
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
          <AnimatePresence mode="wait">
            {!file ? (
              <motion.label key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="cursor-pointer flex flex-col items-center gap-4">
                <div className="p-5 rounded-2xl" style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)' }}>
                  <UploadCloud size={32} style={{ color: '#D4AF37' }} />
                </div>
                <div>
                  <span className="text-sm font-semibold text-white block">{t('upload_drop')}</span>
                  <span className="text-xs text-[#A3A3A3] mt-1 block">{t('upload_supports')}</span>
                </div>
                <input type="file" accept="application/pdf" className="hidden"
                  onChange={(e) => { const f = e.target.files[0]; if (f) { setFile(f); setError(null); } }} />
              </motion.label>
            ) : (
              <motion.div key="file" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3">
                <div className="p-4 rounded-2xl" style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)' }}>
                  <FileText size={32} style={{ color: '#D4AF37' }} />
                </div>
                <p className="text-sm font-semibold text-white">{file.name}</p>
                <p className="text-xs text-[#A3A3A3]">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                <button onClick={() => { setFile(null); setError(null); }} disabled={loading}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition font-medium disabled:opacity-40">
                  <X size={12} /> {t('upload_remove')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="mt-4 flex items-start gap-2 p-3 rounded-xl text-xs text-red-400"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <AlertCircle size={14} className="shrink-0 mt-0.5" /><span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button onClick={handleUpload} disabled={!file || loading}
          whileHover={file && !loading ? { scale: 1.01 } : {}} whileTap={file && !loading ? { scale: 0.99 } : {}}
          className={`mt-6 w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${file && !loading ? 'btn-gold' : ''}`}
          style={!file || loading ? { background: '#1A1A1A', color: '#4A4A4A', border: '1px solid #2A2A2A', cursor: 'not-allowed' } : {}}>
          {loading ? (
            <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-4 h-4 border-2 rounded-full" style={{ borderColor: 'rgba(212,175,55,0.3)', borderTopColor: '#D4AF37' }} />
              {t('upload_processing')}</>
          ) : (
            <><Zap size={15} /> {t('upload_extract')}</>
          )}
        </motion.button>

        <AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="mt-5 space-y-1 overflow-hidden">
              {STEPS.map((s, i) => {
                const n = i + 1, isActive = step === n, isDone = step > n;
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                    className={`pipeline-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
                    <div className={`pipeline-dot ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`} />
                    {isDone ? <CheckCircle2 size={14} className="text-emerald-400" />
                      : <s.icon size={14} style={{ color: isActive ? '#D4AF37' : '#4A4A4A' }} />}
                    <span className="text-xs font-medium" style={{ color: isDone ? '#10B981' : isActive ? '#D4AF37' : '#4A4A4A' }}>
                      {t(s.labelKey)}
                    </span>
                    {isActive && <span className="ml-auto flex gap-0.5">{[0,1,2].map(j => <span key={j} className="ai-thinking-dot" style={{ animationDelay: `${j*0.16}s` }} />)}</span>}
                    {isDone && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="ml-auto text-emerald-400"><CheckCircle2 size={14} /></motion.span>}
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Shield,       titleKey: 'upload_ocr_title',   descKey: 'upload_ocr_desc',   color: '#D4AF37' },
          { icon: Sparkles,     titleKey: 'upload_ai_title',    descKey: 'upload_ai_desc',    color: '#10B981' },
          { icon: AlertCircle,  titleKey: 'upload_anti_title',  descKey: 'upload_anti_desc',  color: '#F59E0B' },
        ].map((f, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
            className="chamber-card p-5 text-center" style={{ background: '#0D0D0D', border: '1px solid #2A2A2A' }}>
            <f.icon size={20} style={{ color: f.color }} className="mx-auto mb-2.5" />
            <h4 className="text-xs font-semibold text-white mb-0.5">{t(f.titleKey)}</h4>
            <p className="text-[11px] text-[#A3A3A3] leading-relaxed">{t(f.descKey)}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
