import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, FileText, Table, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';
import { format } from 'date-fns';
import { useLanguage } from '../i18n/LanguageContext';

export default function ExportMenu({ caseData }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const exportCSV = () => {
    if (!caseData?.directives?.length) { toast.error(t('export_no_directives')); return; }
    const rows = caseData.directives.map(d => ({
      ID: d.id, Directive: d.directive_text, Department: d.responsible_department,
      Priority: d.priority, Status: d.status, Type: d.directive_type,
      Deadline: d.deadline ? format(new Date(d.deadline), 'yyyy-MM-dd') : 'N/A',
      Confidence: `${Math.round((d.confidence_score || 0) * 100)}%`,
      'Source Page': d.source_page,
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${caseData.case_number || 'case'}_directives.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(t('export_csv_success')); setOpen(false);
  };

  const exportPDF = () => {
    if (!caseData?.directives?.length) { toast.error(t('export_no_directives')); return; }
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('NyayaSetu — Compliance Report', 14, 18);
    doc.setFontSize(10);
    doc.text(`Case: ${caseData.case_number}`, 14, 28);
    doc.text(`Court: ${caseData.court}`, 14, 34);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, 40);
    autoTable(doc, {
      startY: 48,
      head: [['#', 'Directive', 'Dept', 'Priority', 'Status', 'Deadline']],
      body: caseData.directives.map((d, i) => [
        i + 1, d.directive_text.slice(0, 70) + (d.directive_text.length > 70 ? '…' : ''),
        d.responsible_department, d.priority, d.status,
        d.deadline ? format(new Date(d.deadline), 'dd MMM yyyy') : 'N/A',
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [37, 99, 235] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    doc.save(`${caseData.case_number || 'case'}_report.pdf`);
    toast.success(t('export_pdf_success')); setOpen(false);
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border dark:border-gray-600 rounded-lg hover:bg-surface dark:hover:bg-gray-800 text-ink dark:text-gray-200 transition"
        style={{ borderColor: '#2A2A2A', color: '#A3A3A3', background: 'transparent' }}>
        <Download size={13} /> {t('export_export')} <ChevronDown size={11} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.12 }}
              className="absolute right-0 top-9 w-44 rounded-xl shadow-lg z-50 overflow-hidden"
              style={{ background: '#0D0D0D', border: '1px solid #2A2A2A' }}>
              <button onClick={exportCSV} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-white hover:bg-[#111111] transition">
                <Table size={13} className="text-emerald-500" /> {t('export_csv')}
              </button>
              <button onClick={exportPDF} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-white hover:bg-[#111111] transition">
                <FileText size={13} className="text-red-500" /> {t('export_pdf')}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
