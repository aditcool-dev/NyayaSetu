import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen, Search, ChevronRight } from 'lucide-react';
import { listCases } from '../services/api';
import { format } from 'date-fns';
import { useLanguage } from '../i18n/LanguageContext';

function ConfidenceRing({ score, size = 34, sw = 2.5 }) {
  const r = (size - sw) / 2, c = 2 * Math.PI * r;
  const color = score >= 0.9 ? '#10B981' : score >= 0.8 ? '#D4AF37' : '#F59E0B';
  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg style={{ transform: 'rotate(-90deg)' }} width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#2A2A2A" strokeWidth={sw} />
        <motion.circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - score * c }}
          transition={{ duration: 1, delay: 0.2 }} />
      </svg>
      <span className="absolute text-[9px] font-bold" style={{ color }}>{Math.round(score * 100)}</span>
    </div>
  );
}

export default function Cases() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: cases = [], isLoading } = useQuery({ queryKey: ['cases'], queryFn: listCases });

  const filtered = cases.filter((c) => {
    const matchSearch = !search ||
      c.case_number.toLowerCase().includes(search.toLowerCase()) ||
      c.court.toLowerCase().includes(search.toLowerCase()) ||
      (c.parties_petitioner || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">{t('cases_heading')}</h1>
            <p className="text-sm text-[#64748B] mt-0.5">{cases.length} {t('cases_total')}</p>
          </div>
          <Link to="/upload" className="btn-obsidian text-sm">{t('topbar_new_case')}</Link>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input type="text" placeholder={t('cases_search_placeholder')} value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-[#E2E8F0] rounded-xl bg-white text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] transition" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-[#E2E8F0] rounded-xl bg-white text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] transition">
          <option value="">{t('cases_all_status')}</option>
          <option value="pending">{t('cases_pending')}</option>
          <option value="verified">{t('cases_verified')}</option>
          <option value="closed">{t('cases_closed')}</option>
        </select>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="chamber-card p-5">
              <div className="skeleton h-5 w-48 mb-2" /><div className="skeleton h-3 w-32" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="chamber-card p-16 text-center">
          <FolderOpen size={40} className="text-[#4A4A4A] mx-auto mb-3" />
          <p className="text-[#A3A3A3] font-medium">{t('cases_not_found')}</p>
          <p className="text-[#4A4A4A] text-sm mt-1">{t('cases_adjust_search')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c, i) => {
            const pending = c.directives?.filter(d => d.status === 'pending').length || 0;
            const total = c.directives?.length || 0;
            const progress = total > 0 ? ((total - pending) / total) * 100 : 0;
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }} className="chamber-card p-5 hover:border-[#D4AF37]/40 transition-colors">
                <div className="flex items-center gap-4">
                  <ConfidenceRing score={c.classification_confidence || 0.9} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-sm font-bold text-white">{c.case_number}</h3>
                      <span className={`badge ${c.status === 'verified' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'}`}>
                        {c.status}
                      </span>
                      <span className="badge bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
                        {c.judgment_type || t('common_directive')}
                      </span>
                    </div>
                    <p className="text-xs text-[#A3A3A3] truncate">{c.court}</p>
                    {total > 0 && (
                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex-1 max-w-[160px]">
                          <div className="progress-bar-track" style={{ height: 3 }}>
                            <div className="progress-bar-fill" style={{ width: `${progress}%`, height: '100%' }} />
                          </div>
                        </div>
                        <span className="text-[10px] text-[#4A4A4A]">{total - pending}/{total} {t('sidebar_verified').toLowerCase()}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-bold text-white">{total}</p>
                      <p className="text-[10px] text-[#4A4A4A]">{t('cases_directives')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#A3A3A3]">{c.judgment_date ? format(new Date(c.judgment_date), 'dd MMM yyyy') : '—'}</p>
                      <p className="text-[10px] text-[#4A4A4A]">{t('cases_judgment_date')}</p>
                    </div>
                    <Link to={`/verify/${c.id}`}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-[#0D0D0D] transition"
                      style={{ background: 'linear-gradient(135deg, #D4AF37, #B49450)' }}>
                      {t('dash_review')} <ChevronRight size={13} />
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
