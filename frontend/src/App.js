// src/App.js — RareSignal AI — Premium Sidebar Layout with i18n + 3D Ambient
import React, { useState, useEffect } from 'react';
import { useLang } from './i18n/LanguageContext';
import PatientDashboard from './pages/PatientDashboard';
import SignalVisualization from './pages/SignalVisualization';
import ClinicianView from './pages/ClinicianView';
import PatientSetup from './pages/PatientSetup';
import HPOClusterView from './pages/HPOClusterView';
import HealthReport from './pages/HealthReport';
import SharedExperiences from './pages/SharedExperiences';
import LogSymptoms from './pages/LogSymptoms';
import GestureInput from './pages/GestureInput';
import { listPatients, getFlareAlert } from './api';
import theme from './theme';

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

const NAV_PAGE_IDS = ['dashboard', 'setup', 'input', 'signals', 'clinician', 'health_report', 'log_symptoms', 'gesture_input'];
const GROUP_MAP = {
  dashboard: 'CORE', setup: 'CORE',
  clinician: 'ANALYSIS',
  input: 'MONITORING', signals: 'MONITORING', health_report: 'MONITORING',
  log_symptoms: 'MONITORING', gesture_input: 'MONITORING',
};

// ─── Global 3D keyframes injected once ──────────────────────────────────────
const GLOBAL_STYLE_ID = 'raresignal-3d-styles';
if (!document.getElementById(GLOBAL_STYLE_ID)) {
  const st = document.createElement('style');
  st.id = GLOBAL_STYLE_ID;
  st.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    *, *::before, *::after { box-sizing: border-box; }
    @keyframes orbFloat1 {
      0%,100% { transform: translate(0,0) scale(1); }
      33%      { transform: translate(60px,-40px) scale(1.08); }
      66%      { transform: translate(-30px,50px) scale(0.95); }
    }
    @keyframes orbFloat2 {
      0%,100% { transform: translate(0,0) scale(1); }
      40%      { transform: translate(-70px,60px) scale(1.12); }
      70%      { transform: translate(40px,-30px) scale(0.9); }
    }
    @keyframes orbFloat3 {
      0%,100% { transform: translate(0,0) scale(1); }
      50%      { transform: translate(50px,40px) scale(1.05); }
    }
    @keyframes kpiPulse {
      0%,100% { box-shadow: 0 14px 36px rgba(0,0,0,0.36),0 0 0 1px rgba(110,207,195,0.06); }
      50%      { box-shadow: 0 18px 48px rgba(0,0,0,0.4),0 0 24px rgba(95,179,162,0.12),0 0 0 1px rgba(110,207,195,0.1); }
    }
    @keyframes borderGlow {
      0%,100% { border-color: rgba(95,179,162,0.18); }
      50%      { border-color: rgba(95,179,162,0.4); }
    }
  `;
  document.head.appendChild(st);
}

// ─── Ambient floating orbs (rendered behind main content) ────────────────────
function AmbientOrbs() {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
      {/* Teal orb — top-right */}
      <div style={{
        position: 'absolute', top: '5%', right: '8%',
        width: 520, height: 520, borderRadius: '50%',
        background: `radial-gradient(ellipse, rgba(95,179,162,0.13) 0%, transparent 70%)`,
        filter: 'blur(40px)',
        animation: 'orbFloat1 18s ease-in-out infinite',
      }} />
      {/* Amber orb — bottom-left */}
      <div style={{
        position: 'absolute', bottom: '10%', left: '12%',
        width: 420, height: 420, borderRadius: '50%',
        background: `radial-gradient(ellipse, rgba(244,183,64,0.10) 0%, transparent 70%)`,
        filter: 'blur(50px)',
        animation: 'orbFloat2 22s ease-in-out infinite',
      }} />
      {/* Violet orb — center */}
      <div style={{
        position: 'absolute', top: '40%', left: '38%',
        width: 300, height: 300, borderRadius: '50%',
        background: `radial-gradient(ellipse, rgba(155,138,255,0.07) 0%, transparent 70%)`,
        filter: 'blur(60px)',
        animation: 'orbFloat3 28s ease-in-out infinite',
      }} />
    </div>
  );
}

function NavGlyph({ kind, active }) {
  const stroke = active ? theme.text : theme.textMuted;
  const accent = active ? theme.teal : theme.borderSoft;
  const common = { fill: 'none', stroke, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

  const icons = {
    dashboard: (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" {...common} />
        <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" {...common} />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" {...common} />
        <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" {...common} />
      </>
    ),
    setup: (
      <>
        <circle cx="12" cy="8" r="3.5" {...common} />
        <path d="M5.5 19c1.7-3.3 4.1-4.8 6.5-4.8s4.8 1.5 6.5 4.8" {...common} />
      </>
    ),
    clinician: (
      <>
        <path d="M7 5.5h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z" {...common} />
        <path d="M9 10h6" {...common} />
        <path d="M12 7v6" {...common} />
        <path d="M9 16h6" {...common} />
      </>
    ),
    shared_experiences: (
      <>
        <circle cx="8" cy="10" r="2.5" {...common} />
        <circle cx="16" cy="10" r="2.5" {...common} />
        <path d="M4.8 18c.9-2 2.2-3 3.2-3 .9 0 2.2 1 3.1 3" {...common} />
        <path d="M12.9 18c.9-2 2.2-3 3.1-3 1 0 2.3 1 3.2 3" {...common} />
      </>
    ),
    hpo_cluster: (
      <>
        <circle cx="6.5" cy="7" r="1.7" fill={stroke} />
        <circle cx="17.5" cy="7" r="1.7" fill={stroke} />
        <circle cx="12" cy="17" r="1.7" fill={stroke} />
        <path d="M8 8.2 10.8 15.5M16 8.2l-2.8 7.3M8.2 7h7.6" {...common} />
      </>
    ),
    log_symptoms: (
      <>
        <path d="M8 4.5h8" {...common} />
        <path d="M9 3v3M15 3v3" {...common} />
        <rect x="5" y="6.5" width="14" height="13" rx="2" {...common} />
        <path d="M8.5 11h7M8.5 15h5" {...common} />
      </>
    ),
    gesture_input: (
      <>
        <path d="M8.5 12V7.8a1.4 1.4 0 0 1 2.8 0V11" {...common} />
        <path d="M11.3 11V6.8a1.4 1.4 0 0 1 2.8 0V11" {...common} />
        <path d="M14.1 11V8.3a1.4 1.4 0 0 1 2.8 0v5.2a4.8 4.8 0 0 1-4.8 4.8H10a4 4 0 0 1-4-4v-2.1a1.4 1.4 0 0 1 2.5-.9Z" {...common} />
      </>
    ),
    signals: (
      <>
        <path d="M4.5 16.5h3l2-6 3 9 2.6-6H19.5" {...common} />
      </>
    ),
    health_report: (
      <>
        <path d="M12 20c-4.5-2.6-7-5.5-7-9.3a4 4 0 0 1 7-2.5 4 4 0 0 1 7 2.5c0 3.8-2.5 6.7-7 9.3Z" {...common} />
      </>
    ),
  };

  return (
    <span style={{
      width: 28,
      height: 28,
      borderRadius: 9,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: active ? theme.tealBg : 'rgba(143,163,184,0.06)',
      border: `1px solid ${active ? theme.borderGlow : accent}`,
      flexShrink: 0,
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        {icons[kind] || icons.dashboard}
      </svg>
    </span>
  );
}

const s = {
  app: { display: 'flex', minHeight: '100vh', background: theme.bg, color: theme.text, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", position: 'relative' },
  sidebar: { width: 220, minHeight: '100vh', background: theme.panelGradient, borderRight: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100, boxShadow: theme.shadowSoft },
  logoArea: { padding: '24px 20px 20px', borderBottom: `1px solid ${theme.border}` },
  logoTitle: { fontSize: 18, fontWeight: 800, color: theme.text, letterSpacing: '-0.5px' },
  logoSub: { fontSize: 10, color: theme.teal, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 },
  navSection: { padding: '16px 0 0', flex: 1 },
  navGroupLabel: { fontSize: 10, color: theme.textMuted, fontWeight: 700, letterSpacing: 1.5, padding: '4px 20px 8px', textTransform: 'uppercase' },
  navItem: (active) => ({ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px 9px 20px', cursor: 'pointer', fontSize: 14, color: active ? theme.text : theme.textMuted, fontWeight: active ? 600 : 400, background: active ? theme.tealBg : 'transparent', borderLeft: active ? `3px solid ${theme.teal}` : '3px solid transparent', transition: 'all 0.15s', borderRadius: '0 10px 10px 0', marginRight: 8 }),
  patientArea: { padding: '16px 12px', borderTop: `1px solid ${theme.border}` },
  patientCard: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: theme.surfaceGradient, borderRadius: 10, cursor: 'pointer', boxShadow: theme.shadowSoft },
  patientAvatar: (d) => ({ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, background: DISEASE_COLORS[d]?.bg || '#1f6feb', color: DISEASE_COLORS[d]?.fg || '#fff' }),
  patientName: { fontSize: 13, fontWeight: 600, color: theme.text },
  patientSub: { fontSize: 11, color: theme.teal },
  main: { marginLeft: 220, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' },
  topBar: { height: 56, background: theme.panelGradient, borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', position: 'sticky', top: 0, zIndex: 50 },
  breadcrumb: { fontSize: 14, color: theme.textMuted, display: 'flex', alignItems: 'center', gap: 6 },
  breadcrumbActive: { color: theme.text, fontWeight: 600 },
  topActions: { display: 'flex', gap: 8, alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: '50%', background: theme.teal, display: 'inline-block', marginRight: 6, boxShadow: `0 0 8px ${theme.teal}` },
  statusBadge: { fontSize: 12, background: theme.surfaceAlt, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '5px 12px', color: theme.textMuted, display: 'flex', alignItems: 'center' },
  analyzeBtn: { fontSize: 12, background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDeep})`, border: 'none', borderRadius: 8, padding: '7px 14px', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  // Language toggle
  langToggleWrap: { display: 'flex', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, overflow: 'hidden' },
  langBtn: (active) => ({ padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: active ? theme.teal : 'transparent', color: active ? theme.bg : theme.textMuted, transition: 'all 0.15s' }),
  content: { padding: '32px', flex: 1 },
  patientSelectRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, background: theme.surfaceGradient, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 20px', boxShadow: theme.shadowSoft },
  patientSelectLabel: { fontSize: 13, fontWeight: 600, color: theme.textMuted },
  patientSelect: { flex: 1, padding: '8px 12px', border: `1px solid ${theme.borderSoft}`, borderRadius: 8, fontSize: 13, background: theme.bg, color: theme.text, outline: 'none' },
  diseaseBadge: (d) => ({ padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: DISEASE_COLORS[d]?.bg || '#1f6feb', color: DISEASE_COLORS[d]?.fg || '#bfdbfe' }),
  noPatient: { textAlign: 'center', padding: 80, color: theme.textMuted },
};

// ─── Flare Alert Banner ────────────────────────────────────────────────────────
function FlareAlertBanner({ alert }) {
  const { t } = useLang();
  if (!alert) return null;
  const icons = { CRITICAL: '🔴', WARNING: '🟠', WATCH: '🟡', NORMAL: '🟢' };
  const icon = icons[alert.alert_level] || '⚪';
  const color = alert.alert_color;
  return (
    <div style={{ background: `${color}12`, border: `1.5px solid ${color}`, borderRadius: 14, padding: '14px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ textAlign: 'center', minWidth: 60, flexShrink: 0 }}>
        <div style={{ fontSize: 34, fontWeight: 900, color, lineHeight: 1 }}>{Math.round(alert.days_to_flare)}</div>
        <div style={{ fontSize: 10, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>{t.alertDays}</div>
      </div>
      <div style={{ width: 1, height: 44, background: color, opacity: 0.3, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color }}>{icon} {alert.alert_level} - {t.flarePrediction}</span>
          <span style={{ fontSize: 10, background: `${color}22`, color, padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>{alert.confidence} {t.confidenceLabel}</span>
        </div>
        <div style={{ fontSize: 13, color: theme.textSoft, lineHeight: 1.6 }}>{alert.message}</div>
        <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>
          {t.basedOnRisk} <strong style={{ color: theme.textMuted }}>{alert.based_on_risk}</strong> · {t.notClinicalDiagnosis}
        </div>
      </div>
      {alert.alert_level === 'CRITICAL' && (
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 12px ${color}, 0 0 24px ${color}40` }} />
      )}
    </div>
  );
}

// ─── Dashboard Overview Page ─────────────────────────────────────────────────
function DashboardOverview({ patients, selectedPatient, setSelectedPatient, setPage }) {
  const { t } = useLang();
  const [flareAlert, setFlareAlert] = useState(null);

  useEffect(() => {
    if (!selectedPatient) { setFlareAlert(null); return; }
    getFlareAlert(selectedPatient.id)
      .then(res => setFlareAlert(res.data))
      .catch(() => setFlareAlert(null));
  }, [selectedPatient?.id]);

  const activity = [
    { time: t.activityJustNow, label: t.activitySession, status: 'live' },
    { time: t.activityWaiting, label: t.activityCompute, status: 'wait' },
    { time: t.activityWaiting, label: t.activitySymptoms, status: 'wait' },
  ];

  const [hoveredKpi, setHoveredKpi] = useState(null);

  const kpiGlows = [
    `radial-gradient(ellipse at top right, rgba(95,179,162,0.18), transparent 60%)`,
    `radial-gradient(ellipse at top right, rgba(244,183,64,0.14), transparent 60%)`,
    `radial-gradient(ellipse at top right, rgba(63,185,80,0.14), transparent 60%)`,
  ];

  const c = {
    pageTitle: { fontSize: 28, fontWeight: 800, color: theme.text, margin: 0, letterSpacing: '-0.5px' },
    pageSub: { fontSize: 14, color: theme.textMuted, marginTop: 4, marginBottom: 28 },
    kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 },
    kpiCard: (i) => ({
      background: theme.glass,
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      border: `1px solid ${hoveredKpi === i ? theme.borderGlow : theme.border}`,
      borderRadius: 16,
      padding: 24,
      position: 'relative',
      overflow: 'hidden',
      boxShadow: hoveredKpi === i ? theme.shadowFloat : theme.shadow3d,
      transform: hoveredKpi === i ? 'perspective(600px) translateY(-4px) rotateX(1.5deg)' : 'perspective(600px) translateY(0) rotateX(0)',
      transition: 'all 0.25s ease',
      cursor: 'default',
      animation: 'borderGlow 4s ease-in-out infinite',
    }),
    kpiGlow: (i) => ({
      position: 'absolute', inset: 0,
      background: kpiGlows[i],
      pointerEvents: 'none',
    }),
    kpiShine: {
      position: 'absolute', top: 0, left: 0, right: 0, height: 1,
      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.09), transparent)',
      pointerEvents: 'none',
    },
    kpiLabel: { fontSize: 12, color: theme.textMuted, marginBottom: 8, position: 'relative' },
    kpiValue: { fontSize: 32, fontWeight: 800, color: theme.text, position: 'relative' },
    kpiSub: { fontSize: 12, color: theme.teal, marginTop: 4, fontWeight: 600, position: 'relative' },
    kpiIcon: { position: 'absolute', top: 20, right: 20, fontSize: 28, opacity: 0.22, filter: 'saturate(1.3)' },
    bottom: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
    card: {
      background: theme.glass,
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      border: `1px solid ${theme.border}`,
      borderRadius: 14, padding: 24, boxShadow: theme.shadow3d,
    },
    cardTitle: { fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 },
    actionBtn: (primary) => ({ width: '100%', padding: '13px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 10, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, background: primary ? `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDeep})` : theme.surfaceAlt, color: primary ? '#fff' : theme.textSoft, border: primary ? 'none' : `1px solid ${theme.border}`, transition: 'all 0.15s', boxShadow: primary ? '0 4px 14px rgba(63,185,80,0.28)' : 'none' }),
    activityItem: { display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-start' },
    activityDot: (status) => ({ width: 10, height: 10, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: status === 'live' ? theme.teal : theme.border, boxShadow: status === 'live' ? `0 0 10px ${theme.teal}` : 'none' }),
    activityTime: { fontSize: 11, color: theme.textMuted, marginBottom: 2 },
    activityLabel: { fontSize: 13, color: theme.textSoft, fontWeight: 500 },
  };

  return (
    <div>
      <div style={c.pageTitle}>{t.overviewTitle}</div>
      <div style={c.pageSub}>{t.overviewSub}</div>

      {patients.length > 0 && (
        <div style={{ ...s.patientSelectRow, marginBottom: 24 }}>
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

      {/* Flare Alert Banner */}
      <FlareAlertBanner alert={flareAlert} />

      <div style={c.kpiRow}>
        {[{
          icon: '🧬', label: t.kpiActivePatients,
          value: patients.length,
          sub: patients.length > 0 ? t.kpiActivePatientsSub : t.kpiSetupFirst,
          subColor: theme.teal,
        }, {
          icon: '🔬', label: t.kpiDiseaseProfile,
          value: selectedPatient?.disease || '—',
          valueFontSize: selectedPatient ? 22 : 32,
          sub: selectedPatient ? t.kpiDiseaseProfileActive : t.kpiDiseaseProfileNone,
          subColor: theme.teal,
        }, {
          icon: '🏥', label: t.kpiHPOTerms,
          value: '3+',
          sub: t.kpiHpoExample,
          subColor: theme.amber,
        }].map((kpi, i) => (
          <div
            key={i}
            style={c.kpiCard(i)}
            onMouseEnter={() => setHoveredKpi(i)}
            onMouseLeave={() => setHoveredKpi(null)}
          >
            <div style={c.kpiGlow(i)} />
            <div style={c.kpiShine} />
            <span style={c.kpiIcon}>{kpi.icon}</span>
            <div style={c.kpiLabel}>{kpi.label}</div>
            <div style={{ ...c.kpiValue, fontSize: kpi.valueFontSize || 32 }}>{kpi.value}</div>
            <div style={{ ...c.kpiSub, color: kpi.subColor }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div style={c.bottom}>
        <div style={c.card}>
          <div style={c.cardTitle}>{t.quickActionsTitle}</div>
          <button style={c.actionBtn(true)} onClick={() => setPage('signals')}>{t.quickCompute}</button>
          <button style={c.actionBtn(false)} onClick={() => setPage('log_symptoms')}>{t.quickLog}</button>
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
    input: t.navLogSymptoms, signals: t.navHistory, clinician: t.navClinicianView,
    hpo_cluster: t.navHpoCluster,
    shared_experiences: t.navSharedExperiences,
    health_report: t.navHealthReport,
    log_symptoms: t.navLogSymptoms,
    gesture_input: t.navEasyInput,
  };

  const NAV_ITEMS = [
    { id: 'dashboard', label: t.navDashboard, icon: 'dashboard', group: 'CORE' },
    { id: 'setup', label: t.navPatientProfile, icon: 'setup', group: 'CORE' },
    { id: 'clinician', label: t.navClinicianView, icon: 'clinician', group: 'ANALYSIS' },
    { id: 'shared_experiences', label: t.navSharedExperiences, icon: 'shared_experiences', group: 'ANALYSIS' },
    { id: 'hpo_cluster', label: t.navHpoCluster, icon: 'hpo_cluster', group: 'ANALYSIS' },
    { id: 'log_symptoms', label: t.navLogSymptoms, icon: 'log_symptoms', group: 'MONITORING' },
    { id: 'gesture_input', label: t.navEasyInput, icon: 'gesture_input', group: 'MONITORING' },
    { id: 'signals', label: t.navHistory, icon: 'signals', group: 'MONITORING' },
    { id: 'health_report', label: t.navHealthReport, icon: 'health_report', group: 'MONITORING' },
  ];

  const groups = ['CORE', 'ANALYSIS', 'MONITORING'];
  const grouped = groups.map(g => ({ group: g, label: t.navGroups[g], items: NAV_ITEMS.filter(n => n.group === g) }));

  return (
    <div style={s.app}>
      <AmbientOrbs />
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
                  <NavGlyph kind={item.icon} active={page === item.id} />
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
                <div style={s.patientSub}>{selectedPatient.disease} · {t.patientStatusActive}</div>
              </div>
            </div>
          ) : (
            <div style={{ ...s.patientCard, cursor: 'default', opacity: 0.5 }}>
              <div style={{ ...s.patientAvatar(''), background: theme.surfaceAlt, color: theme.textMuted }}>?</div>
              <div>
                <div style={s.patientName}>{t.noPatient}</div>
                <div style={{ fontSize: 11, color: theme.textMuted }}>{t.noPatientSub}</div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main style={{ ...s.main, perspective: '1200px', perspectiveOrigin: '50% 0%', position: 'relative', zIndex: 1 }}>
        <header style={s.topBar}>
          <div style={s.breadcrumb}>
            {t.breadcrumbDashboard}
            <span style={{ color: theme.border }}>›</span>
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
          {page === 'log_symptoms' && (
            <LogSymptoms patient={selectedPatient} />
          )}
          {page === 'gesture_input' && (
            selectedPatient
              ? <GestureInput patient={selectedPatient} />
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
          {page === 'hpo_cluster' && (
            <HPOClusterView patient={selectedPatient} />
          )}
          {page === 'shared_experiences' && (
            selectedPatient
              ? <SharedExperiences patient={selectedPatient} />
              : <div style={s.noPatient}><p>{t.noPatientOption}</p></div>
          )}
          {page === 'health_report' && (
            selectedPatient
              ? <HealthReport patient={selectedPatient} />
              : <div style={s.noPatient}><p>{t.noPatientOption}</p></div>
          )}
        </div>
      </main>
    </div>
  );
}
