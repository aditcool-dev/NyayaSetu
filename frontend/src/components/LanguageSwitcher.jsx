import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Check } from 'lucide-react';
import { useLanguage, LANGUAGES } from '../i18n/LanguageContext';

const GOLD = '#D4AF37';

export default function LanguageSwitcher() {
  const { lang, switchLanguage } = useLanguage();
  const [open, setOpen] = useState(false);

  const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors"
        style={{ background: open ? `${GOLD}15` : 'transparent', border: `1px solid ${open ? GOLD + '40' : '#2A2A2A'}` }}
        aria-label="Switch language"
      >
        <Globe size={13} style={{ color: GOLD }} />
        <span className="text-xs font-medium" style={{ color: GOLD }}>
          {current.nativeLabel}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-[10px]"
          style={{ color: '#4A4A4A' }}
        >
          ▾
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.13 }}
              className="absolute right-0 top-10 w-44 rounded-xl shadow-2xl z-50 overflow-hidden"
              style={{ background: '#0D0D0D', border: '1px solid #2A2A2A' }}
            >
              {/* Header */}
              <div className="px-3 py-2 border-b" style={{ borderColor: '#1A1A1A' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#4A4A4A' }}>
                  Language / भाषा / ಭಾಷೆ
                </p>
              </div>

              {LANGUAGES.map(language => {
                const isActive = lang === language.code;
                return (
                  <button
                    key={language.code}
                    onClick={() => { switchLanguage(language.code); setOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left"
                    style={{ background: isActive ? `${GOLD}12` : 'transparent' }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#111111'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span className="text-base leading-none">{language.flag}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium" style={{ color: isActive ? GOLD : '#E5E5E5' }}>
                        {language.nativeLabel}
                      </p>
                      <p className="text-[10px]" style={{ color: '#4A4A4A' }}>
                        {language.label}
                      </p>
                    </div>
                    {isActive && (
                      <Check size={12} style={{ color: GOLD }} />
                    )}
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
