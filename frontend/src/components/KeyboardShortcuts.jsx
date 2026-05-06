import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';

const shortcuts = [
  { keys: ['Ctrl', 'K'], description: 'Focus search' },
  { keys: ['Ctrl', 'N'], description: 'New upload' },
  { keys: ['Ctrl', 'D'], description: 'Go to dashboard' },
  { keys: ['?'], description: 'Show shortcuts' },
  { keys: ['Esc'], description: 'Close dialogs' },
];

export function KeyboardShortcuts() {
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => {
      // Don't fire when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowModal((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        navigate('/upload');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        navigate('/');
      }
      if (e.key === 'Escape') {
        setShowModal(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  return (
    <>
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => setShowModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.2 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-80 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-border dark:border-gray-700 overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <Keyboard size={16} className="text-brand" />
                  <h3 className="text-sm font-semibold text-ink dark:text-white">Keyboard Shortcuts</h3>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 rounded-lg hover:bg-surface dark:hover:bg-gray-800 transition-colors"
                >
                  <X size={14} className="text-ink-muted" />
                </button>
              </div>
              <div className="p-4 space-y-2">
                {shortcuts.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-ink-muted dark:text-gray-400">{s.description}</span>
                    <div className="flex gap-1">
                      {s.keys.map((k, j) => (
                        <kbd
                          key={j}
                          className="px-2 py-0.5 text-xs font-mono bg-surface dark:bg-gray-800 border border-border dark:border-gray-600 rounded-md text-ink dark:text-gray-300"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 bg-surface dark:bg-gray-800 border-t border-border dark:border-gray-700">
                <p className="text-xs text-ink-faint dark:text-gray-500 text-center">Press ? to toggle this panel</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
