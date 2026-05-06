import { motion } from 'framer-motion';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { useLanguage } from '../i18n/LanguageContext';

const GOLD = '#D4AF37', OBSIDIAN_2 = '#1A1A1A', OBSIDIAN_3 = '#2A2A2A';

export default function FilterBar({ departments = [] }) {
  const { t } = useLanguage();
  const { filters, setFilter, resetFilters } = useAppStore();
  const hasActiveFilters = Object.values(filters).some(Boolean);

  const selectStyle = { background: OBSIDIAN_2, border: `1px solid ${OBSIDIAN_3}`, borderRadius: 8, padding: '0.35rem 0.6rem', fontSize: '0.75rem', color: '#E5E5E5', outline: 'none', flex: 1 };

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl p-3 space-y-2" style={{ background: '#0D0D0D', border: `1px solid ${OBSIDIAN_3}` }}>
      <div className="flex items-center gap-2">
        <SlidersHorizontal size={12} style={{ color: GOLD }} />
        <span className="text-xs font-medium" style={{ color: '#A3A3A3' }}>{t('filter_filters')}</span>
        {hasActiveFilters && (
          <button onClick={resetFilters} className="ml-auto text-xs flex items-center gap-1 transition-colors hover:text-white" style={{ color: '#EF4444' }}>
            <X size={10} /> {t('filter_clear')}
          </button>
        )}
      </div>
      <div className="relative">
        <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#4A4A4A' }} />
        <input type="text" placeholder={t('filter_search')} value={filters.search}
          onChange={e => setFilter('search', e.target.value)}
          className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg outline-none text-white"
          style={{ background: OBSIDIAN_2, border: `1px solid ${OBSIDIAN_3}` }}
          onFocus={e => { e.target.style.borderColor = GOLD; }}
          onBlur={e => { e.target.style.borderColor = OBSIDIAN_3; }} />
      </div>
      <div className="flex gap-2">
        <select value={filters.status} onChange={e => setFilter('status', e.target.value)} style={selectStyle}>
          <option value="">{t('filter_all_status')}</option>
          <option value="pending">{t('dir_pending')}</option>
          <option value="approved">{t('dir_approved')}</option>
          <option value="rejected">{t('dir_rejected')}</option>
        </select>
        <select value={filters.priority} onChange={e => setFilter('priority', e.target.value)} style={selectStyle}>
          <option value="">{t('filter_all_priority')}</option>
          <option value="High">{t('dir_high')}</option>
          <option value="Medium">{t('dir_medium')}</option>
          <option value="Low">{t('dir_low')}</option>
        </select>
        {departments.length > 0 && (
          <select value={filters.department} onChange={e => setFilter('department', e.target.value)} style={selectStyle}>
            <option value="">{t('filter_all_depts')}</option>
            {departments.map(d => <option key={d} value={d}>{d.length > 20 ? d.slice(0, 18) + '…' : d}</option>)}
          </select>
        )}
      </div>
    </motion.div>
  );
}
