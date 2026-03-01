// src/pages/SignalVisualization.js — Charts for baseline, volatility, FIS radar
import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, ReferenceLine
} from 'recharts';
import { computeSignals, getHistory } from '../api';
import { useLang } from '../i18n/LanguageContext';
import theme from '../theme';


const RISK_COLORS = { LOW: theme.primary, MODERATE: theme.amber, HIGH: theme.amberDeep, CRITICAL: theme.coral, INSUFFICIENT_DATA: theme.textMuted };

const s = {
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  card: { background: theme.panelGradient, borderRadius: 14, padding: 24, border: `1px solid ${theme.border}`, color: theme.text, boxShadow: theme.shadowGlow },
  title: { fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 },
  riskBadge: (r) => ({ display: 'inline-block', padding: '4px 14px', borderRadius: 20, fontWeight: 800, fontSize: 14, background: `${RISK_COLORS[r]}22` || theme.surfaceAlt, color: RISK_COLORS[r] || theme.textMuted, border: `1px solid ${RISK_COLORS[r] || theme.border}` }),
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 },
  stat: { background: theme.surfaceGradient, borderRadius: 12, padding: '18px 20px', border: `1px solid ${theme.border}`, textAlign: 'center', boxShadow: theme.shadowSoft },
  statVal: { fontSize: 28, fontWeight: 800, color: theme.teal },
  statLabel: { fontSize: 11, color: theme.textMuted, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
  refreshBtn: { background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDeep})`, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 },
  loading: { padding: 60, textAlign: 'center', color: theme.textMuted },
  zRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${theme.border}` },
  zName: { fontSize: 13, color: theme.textSoft, textTransform: 'capitalize' },
  zVal: (v) => ({ fontWeight: 700, fontSize: 13, color: Math.abs(v) >= 2 ? theme.coral : Math.abs(v) >= 1 ? theme.amber : theme.primary, background: `${Math.abs(v) >= 2 ? theme.coral : Math.abs(v) >= 1 ? theme.amber : theme.primary}1a`, padding: '2px 10px', borderRadius: 20 }),
  noData: { textAlign: 'center', padding: '40px 0', color: theme.textMuted, fontSize: 14 },
  pageTitle: { fontSize: 24, fontWeight: 800, color: theme.text, letterSpacing: '-0.5px', marginBottom: 4 },
  pageSub: { fontSize: 14, color: theme.textMuted, marginBottom: 24 },
};

function formatSymptomLabel(symptomKey) {
  const words = symptomKey
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  const label = words.join(' ');
  return label.length > 22 ? `${label.slice(0, 22).trimEnd()}...` : label;
}

export default function SignalVisualization({ patient }) {
  const { t } = useLang();
  const [signals, setSignals] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [sigRes, histRes] = await Promise.all([
        computeSignals(patient.id, 7),
        getHistory(patient.id)
      ]);
      setSignals(sigRes.data);
      setHistory(histRes.data.history || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [patient.id]);

  if (loading && !signals) return <div style={s.loading}>{t.computeFirst}</div>;

  const displayRiskLabel = (risk) => t.riskDisplayLabels?.[risk] || risk;
  const displayLevelLabel = (label) => t.levelLabels?.[label] || (label ? label.toUpperCase() : '—');

  const fis = signals?.functional_impact || {};
  const radarData = [
    { domain: t.signalDomains.mobility, value: Math.round((fis.mobility || 0) * 100) },
    { domain: t.signalDomains.cognitive, value: Math.round((fis.cognitive || 0) * 100) },
    { domain: t.signalDomains.sleep, value: Math.round((fis.sleep || 0) * 100) },
    { domain: t.signalDomains.work, value: Math.round((fis.work || 0) * 100) },
    { domain: t.signalDomains.social, value: Math.round((fis.social || 0) * 100) }
  ];

  const zScoreData = signals ? Object.entries(signals.z_scores || {}).map(([sym, d]) => ({
    name: formatSymptomLabel(sym),
    z: parseFloat(d.z_score?.toFixed(2) || 0),
    current: parseFloat(d.value?.toFixed(1) || 0),
    baseline: parseFloat(d.baseline_mu?.toFixed(1) || 0)
  })) : [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, color: theme.text }}>{t.signalDashboardTitle(patient.disease)}</h2>
        <button style={s.refreshBtn} onClick={refresh} disabled={loading}>
          {loading ? t.refreshingSignals : t.refreshSignals}
        </button>
      </div>

      {/* Stats Row */}
      {signals && (
        <div style={s.statGrid}>
          <div style={s.stat}>
            <div style={s.statVal}>{signals.volatility?.value?.toFixed(2) || '—'}</div>
            <div style={s.statLabel}>{t.volatilityIndexLabel}</div>
            <div style={{ fontSize: 11, color: { high: theme.amberDeep, moderate: theme.amber, low: theme.primary }[signals.volatility?.label] || theme.textMuted, marginTop: 4, fontWeight: 700 }}>{displayLevelLabel(signals.volatility?.label)}</div>
          </div>
          <div style={s.stat}>
            <div style={s.statVal}>{fis.composite ? (fis.composite * 100).toFixed(0) + '%' : '—'}</div>
            <div style={s.statLabel}>{t.functionalImpactLabel}</div>
            <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>{displayLevelLabel(fis.severity_label)}</div>
          </div>
          <div style={s.stat}>
            <div style={{ ...s.statVal }}>
              <span style={s.riskBadge(signals.risk_category)}>{displayRiskLabel(signals.risk_category)}</span>
            </div>
            <div style={s.statLabel}>{t.riskCategoryLabel}</div>
            <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>{signals.missingness?.completeness_pct?.toFixed(0)}% {t.completeSuffix}</div>
          </div>
        </div>
      )}

      <div style={s.grid}>
        {/* Z-Score Bar Chart */}
        <div style={s.card}>
          <div style={s.title}>{t.signalDeviationTitle}</div>
          {zScoreData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={zScoreData} layout="vertical" margin={{ left: 148, right: 20, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[-4, 4]} tickCount={9} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tick={{ fontSize: 11, fill: theme.textMuted }}
                  tickLine={{ stroke: theme.textMuted }}
                />
                <Tooltip formatter={(v) => [`${v}σ`, t.zScoreLegend]} />
                <ReferenceLine x={0} stroke={theme.textSoft} strokeWidth={2} />
                <ReferenceLine x={2} stroke={theme.coral} strokeDasharray="4 2" strokeWidth={1.5} label={{ value: '+2σ', position: 'top', fontSize: 10, fill: theme.textSoft }} />
                <ReferenceLine x={-2} stroke={theme.coral} strokeDasharray="4 2" strokeWidth={1.5} />
                <Bar dataKey="z" name={t.zScoreLegend} fill={theme.teal} radius={[0, 3, 3, 0]}
                  label={{ position: 'right', fontSize: 10, fill: theme.textSoft, formatter: v => v > 0 ? `+${v}` : v }} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={s.noData}>{t.logSymptomsForDeviations}</div>}
        </div>

        {/* FIS Radar */}
        <div style={s.card}>
          <div style={s.title}>{t.functionalImpactByDomain}</div>
          {fis.composite > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={80}>
                <PolarGrid />
                <PolarAngleAxis dataKey="domain" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar name="FIS" dataKey="value" stroke={theme.teal} fill={theme.teal} fillOpacity={0.35} />
                <Tooltip formatter={(v) => [`${v}%`, t.impactLegend]} />
              </RadarChart>
            </ResponsiveContainer>
          ) : <div style={s.noData}>{t.noFunctionalImpactYet}</div>}
        </div>

        {/* Longitudinal History */}
        <div style={{ ...s.card, gridColumn: 'span 2' }}>
          <div style={s.title}>{t.longitudinalHistoryTitle}</div>
          {history.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" domain={[0, 4]} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 1]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <ReferenceLine yAxisId="left" y={2} stroke={theme.coral} strokeDasharray="4 2" strokeWidth={1.5} label={{ value: t.threshold2Sigma, fontSize: 10, fill: theme.coral } } />
                <Line yAxisId="left" type="monotone" dataKey="z_score_max" name={t.maxZScoreLegend} stroke={theme.coral} strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="volatility_index" name={t.volatilityIndexLabel} stroke={theme.amber} strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="fis_composite" name="FIS Composite" stroke={theme.teal} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <div style={s.noData}>{t.longitudinalHistoryEmpty}</div>}
        </div>
      </div>

      {/* Trigger Correlations */}
      {signals?.trigger_correlations?.length > 0 && (
        <div style={s.card}>
          <div style={s.title}>{t.triggerAssocAnalysis}</div>
          {signals.trigger_correlations.map((tc, i) => (
            <div key={i} style={s.zRow}>
              <span style={s.zName}>{tc.trigger.replace(/_/g, ' ')}</span>
              <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {tc.significant && <span style={{ fontSize: 11, background: theme.amberBg, color: theme.amber, padding: '2px 8px', borderRadius: 10 }}>{t.significantLabel}</span>}
                <span style={s.zVal(tc.correlation)}>r = {tc.correlation > 0 ? '+' : ''}{tc.correlation.toFixed(3)}</span>
                <span style={{ fontSize: 11, color: theme.textMuted }}>p={tc.p_value.toFixed(3)}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {signals?.red_flags?.length > 0 && (
        <div style={{ background: theme.coralBg, border: `1px solid ${theme.coralDeep}`, borderRadius: 10, padding: '16px 20px', marginTop: 16 }}>
          <div style={{ fontWeight: 700, color: theme.coral, marginBottom: 8 }}>{t.redFlagsDetected}</div>
          {signals.red_flags.map((rf, i) => <div key={i} style={{ color: theme.coral, fontSize: 14 }}>• {rf.replace(/_/g, ' ')}</div>)}
          <div style={{ fontSize: 12, color: theme.coral, marginTop: 10, fontStyle: 'italic' }}>{t.careTeamDisclaimer}</div>
        </div>
      )}
    </div>
  );
}
