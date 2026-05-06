import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Verify from './pages/Verify';
import Cases from './pages/Cases';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import { LanguageProvider } from './i18n/LanguageContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export default function App() {
  return (
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <KeyboardShortcuts />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1A1A1A',
                color: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #2A2A2A',
                fontSize: '13px',
              },
            }}
          />
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="upload" element={<Upload />} />
              <Route path="cases" element={<Cases />} />
              <Route path="verify" element={<Verify />} />
              <Route path="verify/:caseId" element={<Verify />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </LanguageProvider>
  );
}
