// src/App.js — RareSignal AI — Premium Sidebar Layout with i18n
import React, { useState, useEffect } from 'react';
import { useLang } from './i18n/LanguageContext';
import PatientDashboard from './pages/PatientDashboard';
import SignalVisualization from './pages/SignalVisualization';
import ClinicianView from './pages/ClinicianView';
import PatientSetup from './pages/PatientSetup';
import { listPatients } from './api';

const DISEASE_COLORS = {
  POTS: { bg: '#1e3a8a', fg: '#bfdbfe' }, EDS: { bg: '#14532d', fg: '#bbf7d0' },
  ENS: { bg: '#78350f', fg: '#fde68a' }, Heterotaxy: { bg: '#7f1d1d', fg: '#fecaca' },
  PCD: { bg: '#581c87', fg: '#e9d5ff' }, FMF: { bg: '#831843', fg: '#fbcfe8' },
  CF: { bg: '#0c4a6e', fg: '#bae6fd' }, HD: { bg: '#4c1d95', fg: '#ddd6fe' },
  RTT: { bg: '#134e4a', fg: '#99f6e4' }, MFS: { bg: '#1e3a5f', fg: '#93c5fd' },
  SMA: { bg: '#44403c', fg: '#d6d3d1' }, FXS: { bg: '#3b0764', fg: '#e9d5ff' },
  NF1: { bg: '#1a2e05', fg: '#bef264' }, PKU: { bg: '#0f2d40', fg: '#7dd3fc' },
  WD: { bg: '#2d1f04', fg: '#fcd34d' }, Pompe: { bg: '#1c1917', fg: '#e7e5e4' },
  TS: { bg: '#1f0a0a', fg: '#fca5a5' }, Gaucher: { bg: '#042f2e', fg: '#6ee7b7' },
  Alkaptonuria: { bg: '#171717', fg: '#d4d4d4' }, Achondroplasia: { bg: '#082f49', fg: '#38bdf8' },
  RRP: { bg: '#2d0a0a', fg: '#f87171' }, PRION: { bg: '#0c0a09', fg: '#a8a29e' },
};

const NAV_PAGE_IDS = ['dashboard', 'setup', 'input', 'signals', 'clinician'];
const GROUP_MAP = {
  dashboard: 'CORE', setup: 'CORE',
  clinician: 'ANALYSIS',
  input: 'MONITORING', signals: 'MONITORING',
};

const s = {
  app: { display: 'flex', minHeight: '100vh', background: '#0d1117', color: '#e6edf3', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" },
  sidebar: { width: 220, minHeight: '100vh', background: '#161b22', borderRight: '1px solid #21262d', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100 },
  logoArea: { padding: '24px 20px 20px', borderBottom: '1px solid #21262d' },
  logoTitle: { fontSize: 18, fontWeight: 800, color: '#e6edf3', letterSpacing: '-0.5px' },
  logoSub: { fontSize: 10, color: '#3fb950', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 },
  navSection: { padding: '16px 0 0', flex: 1 },
  navGroupLabel: { fontSize: 10, color: '#484f58', fontWeight: 700, letterSpacing: 1.5, padding: '4px 20px 8px', textTransform: 'uppercase' },
  navItem: (active) => ({ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 20px', cursor: 'pointer', fontSize: 14, color: active ? '#e6edf3' : '#8b949e', fontWeight: active ? 600 : 400, background: active ? 'rgba(48,54,61,0.8)' : 'transparent', borderLeft: active ? '3px solid #3fb950' : '3px solid transparent', transition: 'all 0.15s', borderRadius: '0 8px 8px 0', marginRight: 8 }),
  navIcon: { fontSize: 16, opacity: 0.8 },
  patientArea: { padding: '16px 12px', borderTop: '1px solid #21262d' },
  patientCard: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#21262d', borderRadius: 10, cursor: 'pointer' },
  patientAvatar: (d) => ({ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, background: DISEASE_COLORS[d]?.bg || '#1f6feb', color: DISEASE_COLORS[d]?.fg || '#fff' }),
  patientName: { fontSize: 13, fontWeight: 600, color: '#e6edf3' },
  patientSub: { fontSize: 11, color: '#3fb950' },
  main: { marginLeft: 220, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' },
  topBar: { height: 56, background: '#161b22', borderBottom: '1px solid #21262d', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', position: 'sticky', top: 0, zIndex: 50 },
  breadcrumb: { fontSize: 14, color: '#8b949e', display: 'flex', alignItems: 'center', gap: 6 },
  breadcrumbActive: { color: '#e6edf3', fontWeight: 600 },
  topActions: { display: 'flex', gap: 8, alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: '50%', background: '#3fb950', display: 'inline-block', marginRight: 6, boxShadow: '0 0 8px #3fb950' },
  statusBadge: { fontSize: 12, background: '#21262d', border: '1px solid #30363d', borderRadius: 8, padding: '5px 12px', color: '#8b949e', display: 'flex', alignItems: 'center' },
  analyzeBtn: { fontSize: 12, background: 'linear-gradient(135deg, #3fb950, #1a7f37)', border: 'none', borderRadius: 8, padding: '7px 14px', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  // Language toggle
  langToggleWrap: { display: 'flex', background: '#0d1117', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' },
  langBtn: (active) => ({ padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: active ? '#3fb950' : 'transparent', color: active ? '#0d1117' : '#8b949e', transition: 'all 0.15s' }),
  content: { padding: '32px', flex: 1 },
  patientSelectRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, background: '#161b22', border: '1px solid #21262d', borderRadius: 12, padding: '12px 20px' },
  patientSelectLabel: { fontSize: 13, fontWeight: 600, color: '#8b949e' },
  patientSelect: { flex: 1, padding: '8px 12px', border: '1px solid #30363d', borderRadius: 8, fontSize: 13, background: '#0d1117', color: '#e6edf3', outline: 'none' },
  diseaseBadge: (d) => ({ padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: DISEASE_COLORS[d]?.bg || '#1f6feb', color: DISEASE_COLORS[d]?.fg || '#bfdbfe' }),
  noPatient: { textAlign: 'center', padding: 80, color: '#484f58' },
};

// ─── Dashboard Overview Page ─────────────────────────────────────────────────
function DashboardOverview({ patients, selectedPatient, setSelectedPatient, setPage }) {
  const { t } = useLang();

  const activity = [
    { time: t.activityJustNow, label: t.activitySession, status: 'live' },
    { time: t.activityWaiting, label: t.activityCompute, status: 'wait' },
    { time: t.activityWaiting, label: t.activitySymptoms, status: 'wait' },
  ];

  const c = {
    pageTitle: { fontSize: 28, fontWeight: 800, color: '#e6edf3', margin: 0, letterSpacing: '-0.5px' },
    pageSub: { fontSize: 14, color: '#484f58', marginTop: 4, marginBottom: 28 },
    kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 },
    kpiCard: { background: '#161b22', border: '1px solid #21262d', borderRadius: 14, padding: 24, position: 'relative', overflow: 'hidden' },
    kpiLabel: { fontSize: 12, color: '#8b949e', marginBottom: 8 },
    kpiValue: { fontSize: 32, fontWeight: 800, color: '#e6edf3' },
    kpiSub: { fontSize: 12, color: '#3fb950', marginTop: 4, fontWeight: 600 },
    kpiIcon: { position: 'absolute', top: 20, right: 20, fontSize: 28, opacity: 0.15 },
    bottom: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
    card: { background: '#161b22', border: '1px solid #21262d', borderRadius: 14, padding: 24 },
    cardTitle: { fontSize: 11, fontWeight: 700, color: '#484f58', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 },
    actionBtn: (primary) => ({ width: '100%', padding: '13px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 10, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, background: primary ? 'linear-gradient(135deg, #3fb950, #1a7f37)' : '#21262d', color: primary ? '#fff' : '#c9d1d9', border: primary ? 'none' : '1px solid #30363d', transition: 'all 0.15s' }),
    activityItem: { display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-start' },
    activityDot: (status) => ({ width: 10, height: 10, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: status === 'live' ? '#3fb950' : '#30363d', boxShadow: status === 'live' ? '0 0 8px #3fb950' : 'none' }),
    activityTime: { fontSize: 11, color: '#8b949e', marginBottom: 2 },
    activityLabel: { fontSize: 13, color: '#c9d1d9', fontWeight: 500 },
  };

  return (
    <div>
      <div style={c.pageTitle}>{t.overviewTitle}</div>
      <div style={c.pageSub}>{t.overviewSub}</div>

      {patients.length > 0 && (
        <div style={{ ...s.patientSelectRow, marginBottom: 28 }}>
          <span style={s.patientSelectLabel}>{t.activePatient}</span>
          <select style={s.patientSelect} value={selectedPatient?.id || ''} onChange={e => {
            const p = patients.find(pt => pt.id === e.target.value);
            setSelectedPatient(p || null);
          }}>
            {patients.map(p => <option key={p.id} value={p.id}>{p.id} ({p.disease})</option>)}
          </select>
          {selectedPatient && <span style={s.diseaseBadge(selectedPatient.disease)}>{selectedPatient.disease}</span>}
        </div>
      )}

      <div style={c.kpiRow}>
        <div style={c.kpiCard}>
          <span style={c.kpiIcon}>🧬</span>
          <div style={c.kpiLabel}>{t.kpiActivePatients}</div>
          <div style={c.kpiValue}>{patients.length}</div>
          <div style={c.kpiSub}>{patients.length > 0 ? t.kpiActivePatientsSub : t.kpiSetupFirst}</div>
        </div>
        <div style={c.kpiCard}>
          <span style={c.kpiIcon}>🔬</span>
          <div style={c.kpiLabel}>{t.kpiDiseaseProfile}</div>
          <div style={{ ...c.kpiValue, fontSize: selectedPatient ? 22 : 32 }}>{selectedPatient?.disease || '—'}</div>
          <div style={c.kpiSub}>{selectedPatient ? t.kpiDiseaseProfileActive : t.kpiDiseaseProfileNone}</div>
        </div>
        <div style={c.kpiCard}>
          <span style={c.kpiIcon}>🏥</span>
          <div style={c.kpiLabel}>{t.kpiHPOTerms}</div>
          <div style={c.kpiValue}>3+</div>
          <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, marginTop: 4 }}>HP:0002829, HP:0012378 +1</div>
        </div>
      </div>

      <div style={c.bottom}>
        <div style={c.card}>
          <div style={c.cardTitle}>{t.quickActionsTitle}</div>
          <button style={c.actionBtn(true)} onClick={() => setPage('signals')}>{t.quickCompute}</button>
          <button style={c.actionBtn(false)} onClick={() => setPage('input')}>{t.quickLog}</button>
          <button style={c.actionBtn(false)} onClick={() => setPage('clinician')}>{t.quickClinician}</button>
          <button style={c.actionBtn(false)} onClick={() => setPage('setup')}>{t.quickEdit}</button>
        </div>
        <div style={c.card}>
          <div style={c.cardTitle}>{t.recentActivityTitle}</div>
          {activity.map((a, i) => (
            <div key={i} style={c.activityItem}>
              <div style={c.activityDot(a.status)} />
              <div>
                <div style={c.activityTime}>{a.time}</div>
                <div style={c.activityLabel}>{a.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const { t, lang, setLang } = useLang();
  const [page, setPage] = useState('dashboard');
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const loadPatients = async () => {
    try {
      const res = await listPatients();
      setPatients(res.data);
      if (res.data.length > 0 && !selectedPatient) setSelectedPatient(res.data[0]);
    } catch (e) { }
  };

  useEffect(() => { loadPatients(); }, []);

  const onPatientCreated = (patient) => {
    setPatients(prev => [...prev, patient]);
    setSelectedPatient(patient);
    setPage('dashboard');
  };

  const PAGE_LABEL_KEYS = {
    dashboard: t.navDashboard, setup: t.navPatientProfile,
    input: t.navLogSymptoms, signals: t.navHistory, clinician: t.navClinicianView
  };

  const NAV_ITEMS = [
    { id: 'dashboard', label: t.navDashboard, icon: '⬡', group: 'CORE' },
    { id: 'setup', label: t.navPatientProfile, icon: '◎', group: 'CORE' },
    { id: 'clinician', label: t.navClinicianView, icon: '◇', group: 'ANALYSIS' },
    { id: 'input', label: t.navLogSymptoms, icon: '△', group: 'MONITORING' },
    { id: 'signals', label: t.navHistory, icon: '▷', group: 'MONITORING' },
  ];

  const groups = ['CORE', 'ANALYSIS', 'MONITORING'];
  const grouped = groups.map(g => ({ group: g, label: t.navGroups[g], items: NAV_ITEMS.filter(n => n.group === g) }));

  return (
    <div style={s.app}>
      {/* ── Sidebar ── */}
      <aside style={s.sidebar}>
        <div style={s.logoArea}>
          <div style={s.logoTitle}>{t.appTitle}</div>
          <div style={s.logoSub}>{t.appSub}</div>
        </div>
        <nav style={s.navSection}>
          {grouped.map(({ group, label, items }) => (
            <div key={group}>
              <div style={s.navGroupLabel}>{label}</div>
              {items.map(item => (
                <div key={item.id} style={s.navItem(page === item.id)} onClick={() => setPage(item.id)}>
                  <span style={s.navIcon}>{item.icon}</span>
                  {item.label}
                </div>
              ))}
            </div>
          ))}
        </nav>
        <div style={s.patientArea}>
          {selectedPatient ? (
            <div style={s.patientCard} onClick={() => setPage('setup')}>
              <div style={s.patientAvatar(selectedPatient.disease)}>
                {selectedPatient.id.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={s.patientName}>{selectedPatient.id}</div>
                <div style={s.patientSub}>{selectedPatient.disease} · Active</div>
              </div>
            </div>
          ) : (
            <div style={{ ...s.patientCard, cursor: 'default', opacity: 0.5 }}>
              <div style={{ ...s.patientAvatar(''), background: '#21262d', color: '#8b949e' }}>?</div>
              <div>
                <div style={s.patientName}>{t.noPatient}</div>
                <div style={{ fontSize: 11, color: '#484f58' }}>{t.noPatientSub}</div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main style={s.main}>
        <header style={s.topBar}>
          <div style={s.breadcrumb}>
            {t.breadcrumbDashboard}
            <span style={{ color: '#30363d' }}>›</span>
            <span style={s.breadcrumbActive}>{PAGE_LABEL_KEYS[page]}</span>
          </div>
          <div style={s.topActions}>
            {/* ── Language Toggle ── */}
            <div style={s.langToggleWrap}>
              <button style={s.langBtn(lang === 'en')} onClick={() => setLang('en')}>
                {t.langEN}
              </button>
              <button style={s.langBtn(lang === 'es')} onClick={() => setLang('es')}>
                {t.langES}
              </button>
            </div>
            <div style={s.statusBadge}>
              <span style={s.statusDot} />
              {t.systemOnline}
            </div>
            <button style={s.analyzeBtn} onClick={() => setPage('signals')}>
              {t.quickAnalyze}
            </button>
          </div>
        </header>

        <div style={s.content}>
          {page !== 'setup' && page !== 'dashboard' && (
            <div style={s.patientSelectRow}>
              <span style={s.patientSelectLabel}>{t.activePatient}</span>
              <select style={s.patientSelect} value={selectedPatient?.id || ''} onChange={e => {
                const p = patients.find(pt => pt.id === e.target.value);
                setSelectedPatient(p || null);
              }}>
                {patients.length === 0 && <option value="">{t.noPatientOption}</option>}
                {patients.map(p => <option key={p.id} value={p.id}>{p.id} ({p.disease})</option>)}
              </select>
              {selectedPatient && <span style={s.diseaseBadge(selectedPatient.disease)}>{selectedPatient.disease}</span>}
            </div>
          )}

          {page === 'dashboard' && (
            <DashboardOverview
              patients={patients} selectedPatient={selectedPatient}
              setSelectedPatient={setSelectedPatient} setPage={setPage}
            />
          )}
          {page === 'setup' && <PatientSetup onPatientCreated={onPatientCreated} />}
          {page === 'input' && (
            selectedPatient
              ? <PatientDashboard patient={selectedPatient} />
              : <div style={s.noPatient}><p>{t.noPatientOption}</p></div>
          )}
          {page === 'signals' && (
            selectedPatient
              ? <SignalVisualization patient={selectedPatient} />
              : <div style={s.noPatient}><p>{t.noPatientOption}</p></div>
          )}
          {page === 'clinician' && (
            selectedPatient
              ? <ClinicianView patient={selectedPatient} />
              : <div style={s.noPatient}><p>{t.noPatientOption}</p></div>
          )}
        </div>
      </main>
    </div>
  );
}
