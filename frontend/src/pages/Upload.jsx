import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Sparkles, Shield, Zap } from 'lucide-react';
import { uploadCase } from '../services/api';

export default function Upload() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const navigate = useNavigate();

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true); setStep(1);
    setTimeout(() => setStep(2), 2000);
    try {
      const data = await uploadCase(file);
      setStep(3);
      setTimeout(() => navigate(`/verify/${data.id}`), 1000);
    } catch (error) { console.error(error); alert('Upload failed'); setLoading(false); setStep(0); }
  };

  const handleDragOver = useCallback(e => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);
  const handleDrop = useCallback(e => {
    e.preventDefault(); setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === 'application/pdf') setFile(f);
  }, []);

  const steps = [
    { label: 'Extracting text via OCR engine', icon: FileText },
    { label: 'AI analyzing directives & workflows', icon: Sparkles },
    { label: 'Verification dashboard ready', icon: CheckCircle2 },
  ];

  return (
    <div className="max-w-3xl mx-auto mt-4 space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-ink tracking-tight">Upload Judgment</h1>
        <p className="text-sm text-ink-muted mt-0.5">Upload a court judgment PDF for AI-powered directive extraction</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="card p-8">
        <div className={`drop-zone p-14 text-center ${isDragOver || file ? 'active' : ''}`}
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
          <AnimatePresence mode="wait">
            {!file ? (
              <motion.label key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="cursor-pointer flex flex-col items-center gap-4">
                <div className="p-5 rounded-2xl bg-teal/6 border border-teal/10">
                  <UploadCloud size={32} className="text-teal" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-ink block">Drop PDF here or click to browse</span>
                  <span className="text-xs text-ink-muted mt-1 block">Supports scanned & digital judgments up to 20MB</span>
                </div>
                <input type="file" accept="application/pdf" className="hidden" onChange={e => setFile(e.target.files[0])} />
              </motion.label>
            ) : (
              <motion.div key="f" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3">
                <div className="p-4 rounded-2xl bg-brand/6 border border-brand/10">
                  <FileText size={32} className="text-brand" />
                </div>
                <p className="text-sm font-semibold text-ink">{file.name}</p>
                <p className="text-xs text-ink-muted">{(file.size / (1024*1024)).toFixed(2)} MB</p>
                <button onClick={() => setFile(null)} disabled={loading}
                  className="text-xs text-red-400 hover:text-red-500 transition font-medium">Remove</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.button onClick={handleUpload} disabled={!file || loading}
          className={`mt-6 w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
            file && !loading ? 'btn-primary' : 'bg-surface-alt text-ink-faint cursor-not-allowed border border-border'
          }`}>
          {loading ? (
            <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Processing...</>
          ) : <><Zap size={15} /> Extract Compliance Plan</>}
        </motion.button>

        <AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="mt-5 space-y-1 overflow-hidden">
              {steps.map((s, i) => {
                const n = i + 1, act = step === n, dn = step > n;
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className={`pipeline-step ${act ? 'active' : ''} ${dn ? 'done' : ''}`}>
                    <div className={`pipeline-dot ${act ? 'active' : ''} ${dn ? 'done' : ''}`} />
                    <s.icon size={14} className={dn ? 'text-emerald-500' : act ? 'text-teal' : 'text-ink-faint'} />
                    <span className={`text-xs font-medium ${dn ? 'text-emerald-600' : act ? 'text-ink' : 'text-ink-faint'}`}>{s.label}</span>
                    {dn && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="ml-auto text-emerald-500"><CheckCircle2 size={14} /></motion.span>}
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Shield, title: 'Hybrid OCR', desc: 'pdfplumber + Tesseract for scanned documents', color: 'text-brand' },
          { icon: Sparkles, title: 'Gemini AI', desc: 'Structured directive extraction with workflow grouping', color: 'text-teal' },
          { icon: AlertCircle, title: 'Anti-Hallucination', desc: 'Zero fabricated deadlines or compliance tasks', color: 'text-amber-500' },
        ].map((f, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }} className="card p-5 text-center">
            <f.icon size={20} className={`${f.color} mx-auto mb-2.5`} />
            <h4 className="text-xs font-semibold text-ink mb-0.5">{f.title}</h4>
            <p className="text-[11px] text-ink-muted leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
