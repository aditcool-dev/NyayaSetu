import { motion } from 'framer-motion';
import { CheckCircle, XCircle, X, Layers } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

const GOLD = '#D4AF37';

export default function BatchActionBar({ selectedCount, onApprove, onReject, onClear }) {
  const { t } = useLanguage();
  return (
    <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
      className="rounded-xl p-3 flex items-center justify-between"
      style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}30` }}>
      <div className="flex items-center gap-2">
        <Layers size={13} style={{ color: GOLD }} />
        <span className="text-sm font-medium" style={{ color: GOLD }}>
          {selectedCount} {selectedCount !== 1 ? t('batch_directives') : t('batch_directive')} {t('batch_selected')}
        </span>
      </div>
      <div className="flex gap-2">
        <button onClick={onApprove} className="px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5"
          style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)' }}>
          <CheckCircle size={12} /> {t('batch_approve_all')}
        </button>
        <button onClick={onReject} className="px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5"
          style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
          <XCircle size={12} /> {t('batch_reject_all')}
        </button>
        <button onClick={onClear} className="px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5"
          style={{ background: 'rgba(163,163,163,0.1)', color: '#A3A3A3', border: '1px solid rgba(163,163,163,0.2)' }}>
          <X size={12} /> {t('batch_clear')}
        </button>
      </div>
    </motion.div>
  );
}
