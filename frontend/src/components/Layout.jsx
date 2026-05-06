import { useState } from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Scale, Upload, FolderOpen, CheckSquare, BarChart3,
  Settings, User, Search, LogOut, Zap, AlertTriangle,
} from 'lucide-react';
import NotificationCenter from './NotificationCenter';
import LanguageSwitcher from './LanguageSwitcher';
import { getDashboardStats, getPipelineHealth } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';

export default function Layout() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Navigation items — labels translated
  const navigation = [
    { key: 'nav_dashboard',    href: '/',        icon: Scale,       exact: true },
    { key: 'nav_upload',       href: '/upload',  icon: Upload },
    { key: 'nav_cases',        href: '/cases',   icon: FolderOpen },
    { key: 'nav_verification', href: '/verify',  icon: CheckSquare },
    { key: 'nav_analytics',    href: '/reports', icon: BarChart3 },
    { key: 'nav_settings',     href: '/settings',icon: Settings },
  ];

  // Live stats for sidebar badges
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    refetchInterval: 30_000,
  });

  // Live pipeline health for AI status indicator
  const { data: health } = useQuery({
    queryKey: ['pipeline-health'],
    queryFn: getPipelineHealth,
    refetchInterval: 60_000,
    retry: false,
  });

  const pendingCount = stats?.pending_directives ?? 0;
  const overdueCount = stats?.overdue_directives ?? 0;
  const aiHealthy = health?.status === 'healthy';
  const aiDegraded = health?.status === 'degraded';
  const aiUnknown = !health;

  const handleSearch = (e) => {
    if (e.key === 'Enter' && search.trim()) {
      navigate(`/cases?q=${encodeURIComponent(search.trim())}`);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* ═══ SIDEBAR ═══ */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <Link to="/" className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 8, scale: 1.05 }}
              className="w-10 h-10 rounded-xl gold-bg flex items-center justify-center shadow-lg"
              style={{ boxShadow: '0 4px 12px rgba(212,175,55,0.3)' }}
            >
              <Scale size={20} style={{ color: '#0D0D0D' }} />
            </motion.div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight leading-tight">NyayaSetu</h1>
              <p className="text-[9px] text-[#A3A3A3] font-medium tracking-[0.15em] uppercase">Legal Compliance</p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <p className="text-[9px] text-[#4A4A4A] font-semibold uppercase tracking-[0.12em] px-3 mb-2">{t('nav_navigation')}</p>
          {navigation.map((item) => (
            <NavLink
              key={item.key}
              to={item.href}
              end={item.exact}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <item.icon size={16} />
              <span className="flex-1">{t(item.key)}</span>
              {/* Live badges */}
              {item.key === 'nav_verification' && pendingCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(245,158,11,0.2)', color: '#F59E0B' }}>
                  {pendingCount}
                </span>
              )}
              {item.key === 'nav_dashboard' && overdueCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(239,68,68,0.2)', color: '#EF4444' }}>
                  {overdueCount}
                </span>
              )}
            </NavLink>
          ))}

          {/* Divider */}
          <div className="my-4 border-t border-[#2A2A2A]" />

          {/* Live AI status */}
          <div className="px-3 py-3 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A]">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={12} className="text-[#D4AF37]" />
              <span className="text-[10px] text-[#A3A3A3] font-medium uppercase tracking-wider">{t('sidebar_ai_status')}</span>
            </div>
            {aiUnknown ? (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#4A4A4A] rounded-full" />
                <span className="text-xs text-[#4A4A4A] font-medium">{t('sidebar_checking')}</span>
              </div>
            ) : aiHealthy ? (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full status-dot" />
                <span className="text-xs text-emerald-400 font-medium">{t('sidebar_gemini_active')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <AlertTriangle size={12} className="text-amber-400" />
                <span className="text-xs text-amber-400 font-medium">{t('sidebar_degraded')}</span>
              </div>
            )}
            {/* Show which deps are missing if degraded */}
            {aiDegraded && health?.dependencies && (
              <div className="mt-1.5 space-y-0.5">
                {Object.entries(health.dependencies)
                  .filter(([, v]) => !v)
                  .map(([k]) => (
                    <p key={k} className="text-[10px]" style={{ color: '#4A4A4A' }}>
                      ✗ {k.replace(/_/g, ' ')}
                    </p>
                  ))}
              </div>
            )}
          </div>

          {/* Live summary pill */}
          {stats && (
            <div className="mt-3 px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A]">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {[
                  { labelKey: 'sidebar_cases',   value: stats.total_cases },
                  { labelKey: 'sidebar_verified', value: stats.verified_cases },
                  { labelKey: 'sidebar_pending',  value: stats.pending_directives, warn: true },
                  { labelKey: 'sidebar_overdue',  value: stats.overdue_directives, danger: true },
                ].map(({ labelKey, value, warn, danger }) => (
                  <div key={labelKey}>
                    <p className="text-[10px]" style={{ color: danger && value > 0 ? '#EF4444' : warn && value > 0 ? '#F59E0B' : '#4A4A4A' }}>
                      {t(labelKey)}
                    </p>
                    <p className="text-xs font-bold" style={{ color: danger && value > 0 ? '#EF4444' : warn && value > 0 ? '#F59E0B' : '#A3A3A3' }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* User footer */}
        <div className="sidebar-footer">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A]">
            <div className="w-9 h-9 rounded-full bg-[#2A2A2A] flex items-center justify-center shrink-0">
              <User size={16} className="text-[#D4AF37]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">Justice Sharma</p>
              <p className="text-[10px] text-[#A3A3A3] truncate">District Judge</p>
            </div>
            <button className="p-1 rounded-lg hover:bg-[#2A2A2A] transition-colors">
              <LogOut size={14} className="text-[#A3A3A3]" />
            </button>
          </div>
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <div className="main-content flex flex-col flex-1">
        {/* Topbar */}
        <header className="topbar">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              placeholder={t('topbar_search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearch}
              className="search-input"
            />
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <NotificationCenter />
            <Link to="/upload" className="btn-obsidian text-sm">
              {t('topbar_new_case')}
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-8">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="border-t border-[#E2E8F0] py-3 px-8">
          <div className="flex items-center justify-between text-xs text-[#94A3B8]">
            <span>{t('footer_powered')}</span>
            <span>
              NyayaSetu v2.0 •{' '}
              {stats ? (
                <span style={{ color: '#D4AF37' }}>
                  {stats.compliance_rate}% {t('footer_compliance')}
                </span>
              ) : '—'}{' '}
              • {t('footer_shortcuts')}
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
