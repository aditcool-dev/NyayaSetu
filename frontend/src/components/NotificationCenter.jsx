import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCircle, AlertTriangle, Info, CheckCheck, Trash2 } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { useLanguage } from '../i18n/LanguageContext';
import { formatDistanceToNow } from 'date-fns';

const GOLD = '#D4AF37';
const typeConfig = {
  success: { icon: CheckCircle,   color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  warning: { icon: AlertTriangle, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  error:   { icon: AlertTriangle, color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  info:    { icon: Info,          color: GOLD,      bg: 'rgba(212,175,55,0.12)' },
};

export default function NotificationCenter() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const { notifications, markNotificationRead, markAllRead, clearNotifications } = useAppStore();
  const unread = notifications.filter(n => !n.read).length;

  return (
    <div className="relative">
      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)} className="relative p-2 rounded-lg transition-colors"
        style={{ color: '#A3A3A3' }} aria-label={t('notif_heading')}>
        <Bell size={16} />
        {unread > 0 && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 w-4 h-4 text-white text-[9px] font-bold rounded-full flex items-center justify-center"
            style={{ background: '#EF4444' }}>
            {unread > 9 ? '9+' : unread}
          </motion.span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }} transition={{ duration: 0.15 }}
              className="absolute right-0 top-10 w-80 rounded-2xl shadow-2xl z-50 overflow-hidden"
              style={{ background: '#0D0D0D', border: '1px solid #2A2A2A' }}>

              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#2A2A2A' }}>
                <div className="flex items-center gap-2">
                  <Bell size={13} style={{ color: GOLD }} />
                  <h3 className="text-sm font-semibold text-white">{t('notif_heading')}</h3>
                  {unread > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.2)', color: '#EF4444' }}>{unread}</span>
                  )}
                </div>
                <div className="flex gap-3">
                  {unread > 0 && (
                    <button onClick={markAllRead} className="text-xs flex items-center gap-1 transition-colors hover:text-white" style={{ color: GOLD }}>
                      <CheckCheck size={11} /> {t('notif_mark_all')}
                    </button>
                  )}
                  <button onClick={clearNotifications} className="text-xs flex items-center gap-1 transition-colors hover:text-red-400" style={{ color: '#4A4A4A' }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-12 text-center">
                    <Bell size={24} style={{ color: '#2A2A2A' }} className="mx-auto mb-2" />
                    <p className="text-xs" style={{ color: '#4A4A4A' }}>{t('notif_empty')}</p>
                    <p className="text-[10px] mt-1" style={{ color: '#2A2A2A' }}>{t('notif_empty_desc')}</p>
                  </div>
                ) : (
                  notifications.map(n => {
                    const cfg = typeConfig[n.type] || typeConfig.info;
                    const Icon = cfg.icon;
                    return (
                      <motion.div key={n.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        onClick={() => markNotificationRead(n.id)}
                        className="flex gap-3 px-4 py-3 cursor-pointer transition-colors border-b"
                        style={{ borderColor: '#1A1A1A', background: !n.read ? 'rgba(212,175,55,0.04)' : 'transparent' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#111111'}
                        onMouseLeave={e => e.currentTarget.style.background = !n.read ? 'rgba(212,175,55,0.04)' : 'transparent'}>
                        <div className="p-1.5 rounded-lg shrink-0 mt-0.5" style={{ background: cfg.bg }}>
                          <Icon size={12} style={{ color: cfg.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white">{n.title}</p>
                          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#A3A3A3' }}>{n.message}</p>
                          <p className="text-[10px] mt-1" style={{ color: '#4A4A4A' }}>
                            {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                          </p>
                        </div>
                        {!n.read && <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: GOLD }} />}
                      </motion.div>
                    );
                  })
                )}
              </div>

              {notifications.length > 0 && (
                <div className="px-4 py-2.5 border-t text-center" style={{ borderColor: '#2A2A2A', background: '#0D0D0D' }}>
                  <p className="text-[10px]" style={{ color: '#4A4A4A' }}>
                    {notifications.length} {notifications.length !== 1 ? t('notif_total_plural') : t('notif_total')} {t('notif_total_suffix')}
                  </p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
