import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';

  return (
    <motion.button
      onClick={toggleTheme}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="relative w-14 h-7 rounded-full border border-border dark:border-gray-600 bg-surface dark:bg-gray-800 flex items-center px-1 transition-colors"
      aria-label="Toggle theme"
    >
      <motion.div
        layout
        animate={{ x: isDark ? 26 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="w-5 h-5 rounded-full bg-white dark:bg-gray-200 shadow-sm flex items-center justify-center"
      >
        {isDark ? (
          <Moon size={11} className="text-brand" />
        ) : (
          <Sun size={11} className="text-amber-500" />
        )}
      </motion.div>
    </motion.button>
  );
}
