import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  User, Shield, Bell, Monitor, Lock, Camera, Award, Calendar,
  FileText, Users, Sun, Moon, Save, Edit2, CheckCircle, Key, Keyboard, Info,
} from 'lucide-react';
import { getDashboardStats, listCases } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';

const GOLD = '#D4AF37', OBSIDIAN = '#0D0D0D', OBSIDIAN_2 = '#1A1A1A', OBSIDIAN_3 = '#2A2A2A';
const EMERALD = '#10B981', PURPLE = '#8B5CF6';

function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
      style={{ background: value ? GOLD : OBSIDIAN_3 }}>
      <motion.span layout animate={{ x: value ? 22 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="inline-block h-4 w-4 rounded-full bg-white shadow-sm" />
    </button>
  );
}

function Section({ title, children }) {
  return (
    <div className="chamber-card overflow-hidden" style={{ background: OBSIDIAN, border: `1px solid ${OBSIDIAN_3}` }}>
      <div className="px-6 py-4 border-b" style={{ borderColor: OBSIDIAN_3 }}>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function FieldRow({ label, value, onChange, type = 'text', disabled }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: '#A3A3A3' }}>{label}</label>
      <input type={type} value={value} disabled={disabled} onChange={e => onChange?.(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none transition"
        style={{ background: OBSIDIAN_2, border: `1px solid ${OBSIDIAN_3}`, opacity: disabled ? 0.5 : 1 }}
        onFocus={e => { if (!disabled) e.target.style.borderColor = GOLD; }}
        onBlur={e => { e.target.style.borderColor = OBSIDIAN_3; }} />
    </div>
  );
}

function NotifRow({ label, description, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-4 border-b last:border-0" style={{ borderColor: OBSIDIAN_3 }}>
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {description && <p className="text-xs mt-0.5" style={{ color: '#A3A3A3' }}>{description}</p>}
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

export default function Settings() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('profile');
  const [isEditing, setIsEditing] = useState(false);

  const { data: stats } = useQuery({ queryKey: ['dashboard-stats'], queryFn: getDashboardStats });
  const { data: cases = [] } = useQuery({ queryKey: ['cases'], queryFn: listCases });

  const verifiedCases = stats?.verified_cases ?? cases.filter(c => c.status === 'verified').length;
  const complianceRate = stats?.compliance_rate ?? 0;
  const deptCount = (stats?.department_stats || []).length;

  const [profile, setProfile] = useState({
    name: 'Justice Arjun Sharma', email: 'arjun.sharma@gov.in', phone: '+91 98765 43210',
    designation: 'District Judge', court: 'Delhi High Court', location: 'New Delhi, India',
    badgeNumber: 'JUD-2024-001', joinDate: '2015-03-15',
  });
  const [notifications, setNotifications] = useState({
    emailAlerts: true, deadlineReminders: true, caseAssignments: true,
    weeklyReports: false, systemUpdates: true, batchActions: true,
  });
  const [appearance, setAppearance] = useState({ theme: 'dark', compactView: false, animations: true, highContrast: false });
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });

  const setNotif = (k, v) => setNotifications(p => ({ ...p, [k]: v }));
  const setAppear = (k, v) => setAppearance(p => ({ ...p, [k]: v }));
  const setProf = (k, v) => setProfile(p => ({ ...p, [k]: v }));

  const TABS = [
    { id: 'profile',       labelKey: 'settings_profile',       icon: User },
    { id: 'notifications', labelKey: 'settings_notifications', icon: Bell },
    { id: 'appearance',    labelKey: 'settings_appearance',    icon: Monitor },
    { id: 'security',      labelKey: 'settings_security',      icon: Shield },
    { id: 'shortcuts',     labelKey: 'settings_shortcuts',     icon: Keyboard },
    { id: 'about',         labelKey: 'settings_about',         icon: Info },
  ];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">{t('settings_heading')}</h1>
        <p className="text-sm text-[#64748B] mt-0.5">{t('settings_subtitle')}</p>
      </motion.div>

      <div className="flex gap-6">
        {/* Sidebar tabs */}
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="w-56 shrink-0">
          <div className="chamber-card overflow-hidden sticky top-24" style={{ background: OBSIDIAN, border: `1px solid ${OBSIDIAN_3}` }}>
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className="w-full flex items-center gap-3 px-5 py-3 text-sm font-medium transition-all text-left"
                  style={active ? { background: `${GOLD}15`, color: GOLD, borderLeft: `2px solid ${GOLD}` } : { color: '#A3A3A3', borderLeft: '2px solid transparent' }}>
                  <Icon size={15} />{t(tab.labelKey)}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Content */}
        <div className="flex-1 space-y-5">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>

              {/* PROFILE */}
              {activeTab === 'profile' && (
                <div className="space-y-5">
                  <div className="chamber-card overflow-hidden" style={{ background: OBSIDIAN, border: `1px solid ${OBSIDIAN_3}` }}>
                    <div className="p-6" style={{ background: `linear-gradient(135deg, ${GOLD}15, transparent)` }}>
                      <div className="flex items-center gap-5">
                        <div className="relative">
                          <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: OBSIDIAN_2, border: `2px solid ${GOLD}` }}>
                            <User size={32} style={{ color: GOLD }} />
                          </div>
                          <button className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: GOLD }}>
                            <Camera size={11} style={{ color: OBSIDIAN }} />
                          </button>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-lg font-bold text-white">{profile.name}</h2>
                            <span className="gold-badge"><CheckCircle size={10} /> {t('settings_verified_badge')}</span>
                          </div>
                          <p className="text-sm" style={{ color: '#A3A3A3' }}>{profile.designation}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: '#4A4A4A' }}>
                            <span className="flex items-center gap-1"><Award size={11} style={{ color: GOLD }} /> {profile.badgeNumber}</span>
                            <span className="flex items-center gap-1"><Calendar size={11} style={{ color: GOLD }} /> {new Date(profile.joinDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short' })}</span>
                          </div>
                        </div>
                        <button onClick={() => setIsEditing(v => !v)} className="btn-gold text-xs">
                          {isEditing ? <><Save size={13} /> {t('settings_save')}</> : <><Edit2 size={13} /> {t('settings_edit')}</>}
                        </button>
                      </div>
                    </div>
                    <div className="p-6 border-t" style={{ borderColor: OBSIDIAN_3 }}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FieldRow label={t('settings_full_name')} value={profile.name} onChange={v => setProf('name', v)} disabled={!isEditing} />
                        <FieldRow label={t('settings_email')} value={profile.email} type="email" onChange={v => setProf('email', v)} disabled={!isEditing} />
                        <FieldRow label={t('settings_phone')} value={profile.phone} type="tel" onChange={v => setProf('phone', v)} disabled={!isEditing} />
                        <FieldRow label={t('settings_designation')} value={profile.designation} onChange={v => setProf('designation', v)} disabled={!isEditing} />
                        <FieldRow label={t('settings_court')} value={profile.court} onChange={v => setProf('court', v)} disabled={!isEditing} />
                        <FieldRow label={t('settings_location')} value={profile.location} onChange={v => setProf('location', v)} disabled={!isEditing} />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { icon: FileText, labelKey: 'settings_cases_verified', value: verifiedCases, subKey: 'settings_of_total', color: GOLD },
                      { icon: CheckCircle, labelKey: 'settings_compliance_rate', value: `${complianceRate}%`, subKey: 'settings_approved_dirs', color: EMERALD },
                      { icon: Users, labelKey: 'settings_departments', value: deptCount, subKey: 'settings_active_system', color: PURPLE },
                    ].map(({ icon: Icon, labelKey, value, subKey, color }, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                        className="chamber-card p-5" style={{ background: OBSIDIAN, border: `1px solid ${OBSIDIAN_3}` }}>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 rounded-lg" style={{ background: `${color}18` }}><Icon size={16} style={{ color }} /></div>
                          <p className="text-sm font-medium text-white">{t(labelKey)}</p>
                        </div>
                        <p className="text-2xl font-bold text-white">{value}</p>
                        <p className="text-xs mt-1" style={{ color: '#4A4A4A' }}>{t(subKey)}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* NOTIFICATIONS */}
              {activeTab === 'notifications' && (
                <Section title={t('settings_notif_prefs')}>
                  <NotifRow label={t('settings_email_alerts')} description={t('settings_email_alerts_desc')} value={notifications.emailAlerts} onChange={v => setNotif('emailAlerts', v)} />
                  <NotifRow label={t('settings_deadline_reminders')} description={t('settings_deadline_desc')} value={notifications.deadlineReminders} onChange={v => setNotif('deadlineReminders', v)} />
                  <NotifRow label={t('settings_case_assignments')} description={t('settings_case_assign_desc')} value={notifications.caseAssignments} onChange={v => setNotif('caseAssignments', v)} />
                  <NotifRow label={t('settings_weekly_reports')} description={t('settings_weekly_desc')} value={notifications.weeklyReports} onChange={v => setNotif('weeklyReports', v)} />
                  <NotifRow label={t('settings_system_updates')} description={t('settings_system_desc')} value={notifications.systemUpdates} onChange={v => setNotif('systemUpdates', v)} />
                  <NotifRow label={t('settings_batch_alerts')} description={t('settings_batch_desc')} value={notifications.batchActions} onChange={v => setNotif('batchActions', v)} />
                </Section>
              )}

              {/* APPEARANCE */}
              {activeTab === 'appearance' && (
                <div className="space-y-5">
                  <Section title={t('settings_theme')}>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { id: 'light', icon: Sun, labelKey: 'settings_light' },
                        { id: 'dark', icon: Moon, labelKey: 'settings_dark' },
                        { id: 'system', icon: Monitor, labelKey: 'settings_system' },
                      ].map(({ id, icon: Icon, labelKey }) => (
                        <button key={id} onClick={() => setAppear('theme', id)}
                          className="p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2"
                          style={appearance.theme === id ? { borderColor: GOLD, background: `${GOLD}10` } : { borderColor: OBSIDIAN_3, background: OBSIDIAN_2 }}>
                          <Icon size={22} style={{ color: appearance.theme === id ? GOLD : '#A3A3A3' }} />
                          <p className="text-sm font-medium" style={{ color: appearance.theme === id ? GOLD : '#A3A3A3' }}>{t(labelKey)}</p>
                        </button>
                      ))}
                    </div>
                  </Section>
                  <Section title={t('settings_display')}>
                    <div className="space-y-0 divide-y" style={{ borderColor: OBSIDIAN_3 }}>
                      {[
                        { key: 'compactView', labelKey: 'settings_compact', descKey: 'settings_compact_desc' },
                        { key: 'animations', labelKey: 'settings_animations', descKey: 'settings_animations_desc' },
                        { key: 'highContrast', labelKey: 'settings_high_contrast', descKey: 'settings_contrast_desc' },
                      ].map(({ key, labelKey, descKey }) => (
                        <div key={key} className="flex items-center justify-between py-4">
                          <div>
                            <p className="text-sm font-medium text-white">{t(labelKey)}</p>
                            <p className="text-xs mt-0.5" style={{ color: '#A3A3A3' }}>{t(descKey)}</p>
                          </div>
                          <Toggle value={appearance[key]} onChange={v => setAppear(key, v)} />
                        </div>
                      ))}
                    </div>
                  </Section>
                </div>
              )}

              {/* SECURITY */}
              {activeTab === 'security' && (
                <div className="space-y-5">
                  <Section title={t('settings_change_password')}>
                    <div className="space-y-4">
                      <FieldRow label={t('settings_current_password')} type="password" value={passwords.current} onChange={v => setPasswords(p => ({ ...p, current: v }))} />
                      <FieldRow label={t('settings_new_password')} type="password" value={passwords.next} onChange={v => setPasswords(p => ({ ...p, next: v }))} />
                      <FieldRow label={t('settings_confirm_password')} type="password" value={passwords.confirm} onChange={v => setPasswords(p => ({ ...p, confirm: v }))} />
                      <button className="btn-gold w-full justify-center mt-2"><Lock size={14} /> {t('settings_update_password')}</button>
                    </div>
                  </Section>
                  <Section title={t('settings_2fa_heading')}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{t('settings_2fa_label')}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#A3A3A3' }}>{t('settings_2fa_desc')}</p>
                      </div>
                      <button className="btn-gold text-xs"><Key size={13} /> {t('settings_enable_2fa')}</button>
                    </div>
                  </Section>
                  <Section title={t('settings_sessions')}>
                    <div className="space-y-3">
                      {[
                        { device: 'Chrome on macOS', location: 'New Delhi, IN', timeKey: 'settings_active_now', current: true },
                        { device: 'Safari on iPhone', location: 'New Delhi, IN', timeKey: null, time: '2 hours ago', current: false },
                      ].map((s, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl" style={{ background: OBSIDIAN_2, border: `1px solid ${OBSIDIAN_3}` }}>
                          <div>
                            <p className="text-sm font-medium text-white flex items-center gap-2">
                              {s.device}
                              {s.current && <span className="gold-badge text-[10px]">{t('settings_current_session')}</span>}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: '#4A4A4A' }}>{s.location} · {s.timeKey ? t(s.timeKey) : s.time}</p>
                          </div>
                          {!s.current && <button className="text-xs text-red-400 hover:text-red-300 transition">{t('settings_revoke')}</button>}
                        </div>
                      ))}
                    </div>
                  </Section>
                </div>
              )}

              {/* SHORTCUTS */}
              {activeTab === 'shortcuts' && (
                <Section title={t('settings_kb_shortcuts')}>
                  <div className="space-y-1">
                    {[
                      { keys: ['?'],          descKey: 'settings_show_shortcuts' },
                      { keys: ['Ctrl', 'N'],  descKey: 'settings_new_upload' },
                      { keys: ['Ctrl', 'D'],  descKey: 'settings_go_dashboard' },
                      { keys: ['Esc'],        descKey: 'settings_close_dialogs' },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center justify-between py-3 border-b last:border-0" style={{ borderColor: OBSIDIAN_3 }}>
                        <span className="text-sm" style={{ color: '#A3A3A3' }}>{t(s.descKey)}</span>
                        <div className="flex gap-1">
                          {s.keys.map((k, j) => (
                            <kbd key={j} className="px-2 py-0.5 text-xs font-mono rounded-md text-white" style={{ background: OBSIDIAN_2, border: `1px solid ${OBSIDIAN_3}` }}>{k}</kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* ABOUT */}
              {activeTab === 'about' && (
                <Section title={t('settings_about_heading')}>
                  <div className="space-y-0 divide-y" style={{ borderColor: OBSIDIAN_3 }}>
                    {[
                      { labelKey: 'settings_version', value: 'v2.0.0' },
                      { labelKey: 'settings_backend', value: 'localhost:8000' },
                      { labelKey: 'settings_ai_model', value: 'Google Gemini' },
                      { labelKey: 'settings_org', value: 'Karnataka Government' },
                      { labelKey: 'settings_platform', value: 'NyayaSetu Decision Intelligence' },
                    ].map(({ labelKey, value }) => (
                      <div key={labelKey} className="flex items-center justify-between py-3">
                        <p className="text-sm" style={{ color: '#A3A3A3' }}>{t(labelKey)}</p>
                        <p className="text-sm font-medium text-white font-mono">{value}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
