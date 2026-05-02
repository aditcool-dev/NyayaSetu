import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Scale, LayoutDashboard, Upload as UploadIcon, Shield } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Verify from './pages/Verify';

function NavLink({ to, children, icon: Icon }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link to={to} className={`nav-link flex items-center gap-2 ${isActive ? 'active' : ''}`}>
      <Icon size={15} />{children}
    </Link>
  );
}

function AppContent() {
  const location = useLocation();
  return (
    <div className="min-h-screen flex flex-col">
      {/* Subtle drifting ambient gradient */}
      <div className="ambient-bg" />

      <nav className="nav-bar sticky top-0 z-50 px-8 py-2.5 relative">
        <div className="w-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <motion.div whileHover={{ rotate: 8, scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="p-2 rounded-xl bg-brand/8 border border-brand/10">
              <Scale size={20} className="text-brand" />
            </motion.div>
            <div>
              <h1 className="text-base font-bold text-ink tracking-tight leading-tight">NyayaSetu</h1>
              <p className="text-[9px] text-ink-muted font-medium tracking-[0.15em] uppercase">Decision Intelligence</p>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <NavLink to="/" icon={LayoutDashboard}>Dashboard</NavLink>
            <NavLink to="/upload" icon={UploadIcon}>Upload</NavLink>
            <div className="ml-3 pl-3 border-l border-border flex items-center gap-2">
              <div className="relative">
                <span className="w-2 h-2 bg-emerald-500 rounded-full block status-dot" />
              </div>
              <span className="text-xs text-emerald-600 font-medium">Online</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname}
            initial={{ opacity: 0, y: 16, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.995 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="px-8 py-6">
            <Routes location={location}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/verify/:caseId" element={<Verify />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="border-t border-border py-3 px-8">
        <div className="w-full flex items-center justify-between text-xs text-ink-muted">
          <div className="flex items-center gap-1.5">
            <Shield size={11} className="text-brand/40" />
            <span>Powered by Gemini AI • Karnataka Government</span>
          </div>
          <span>NyayaSetu v1.0</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return <BrowserRouter><AppContent /></BrowserRouter>;
}
