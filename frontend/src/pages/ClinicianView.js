import React, { useState, useEffect } from 'react';
import { generateSummary, predictRisk, generateAiExplainer, getSensorSummary, getEntries } from '../api';
import { useLang } from '../i18n/LanguageContext';
import theme from '../theme';

const RISK_COLORS = {
  LOW: theme.primary, MODERATE: theme.amber, HIGH: theme.amberDeep, CRITICAL: theme.coral, INSUFFICIENT_DATA: theme.textMuted
};
const RISK_BG = {
  LOW: theme.primaryBg, MODERATE: theme.amberBg, HIGH: theme.amberBg, CRITICAL: theme.coralBg, INSUFFICIENT_DATA: 'rgba(143, 163, 184, 0.14)'
};
const SENSOR_METRIC_CONFIG = {
  heart_rate_avg: { labelKey: 'avgHr', digits: 0 },
  heart_rate_resting: { labelKey: 'restHr', digits: 0 },
  heart_rate_max: { labelKey: 'maxHr', digits: 0 },
  hrv_rmssd: { labelKey: 'hrv', digits: 0 },
  spo2_avg: { labelKey: 'spo2', digits: 1 },
  skin_temp_avg: { labelKey: 'temp', digits: 1 },
  activity_load: { labelKey: 'activity', digits: 0 },
  recovery_score: { labelKey: 'recovery', digits: 0 },
  stress_load: { labelKey: 'stress', digits: 0 }
};

const DISEASE_SENSOR_METRICS = {
  POTS: ['heart_rate_avg', 'heart_rate_resting', 'heart_rate_max', 'hrv_rmssd', 'activity_load', 'recovery_score'],
  PCD: ['spo2_avg', 'heart_rate_avg', 'heart_rate_max', 'activity_load', 'recovery_score'],
  Heterotaxy: ['spo2_avg', 'heart_rate_avg', 'heart_rate_max', 'recovery_score', 'stress_load'],
  ENS: ['heart_rate_avg', 'hrv_rmssd', 'stress_load', 'skin_temp_avg'],
  EDS: ['heart_rate_avg', 'hrv_rmssd', 'activity_load', 'recovery_score', 'stress_load'],
  FMF: ['skin_temp_avg', 'heart_rate_avg', 'heart_rate_max', 'stress_load', 'recovery_score'],
  CF: ['spo2_avg', 'heart_rate_avg', 'heart_rate_max', 'activity_load', 'recovery_score'],
  HD: ['hrv_rmssd', 'stress_load', 'recovery_score', 'activity_load'],
  RTT: ['heart_rate_avg', 'heart_rate_max', 'spo2_avg', 'stress_load', 'recovery_score'],
  MFS: ['heart_rate_avg', 'heart_rate_max', 'hrv_rmssd', 'activity_load', 'recovery_score'],
  SMA: ['spo2_avg', 'heart_rate_avg', 'heart_rate_resting', 'activity_load', 'recovery_score'],
  FXS: ['hrv_rmssd', 'stress_load', 'heart_rate_avg', 'recovery_score'],
  NF1: ['stress_load', 'hrv_rmssd', 'heart_rate_avg', 'recovery_score'],
  PKU: ['hrv_rmssd', 'stress_load', 'heart_rate_avg', 'recovery_score'],
  WD: ['heart_rate_avg', 'heart_rate_max', 'skin_temp_avg', 'stress_load', 'recovery_score'],
  Pompe: ['spo2_avg', 'heart_rate_avg', 'heart_rate_max', 'activity_load', 'recovery_score'],
  TS: ['spo2_avg', 'heart_rate_avg', 'heart_rate_max', 'stress_load', 'recovery_score'],
  Gaucher: ['heart_rate_avg', 'skin_temp_avg', 'activity_load', 'recovery_score', 'stress_load'],
  Alkaptonuria: ['activity_load', 'recovery_score', 'heart_rate_avg', 'stress_load'],
  Achondroplasia: ['spo2_avg', 'activity_load', 'recovery_score', 'heart_rate_avg'],
  RRP: ['spo2_avg', 'heart_rate_avg', 'heart_rate_max', 'stress_load', 'recovery_score'],
  PRION: ['hrv_rmssd', 'stress_load', 'heart_rate_avg', 'heart_rate_max', 'recovery_score']
};

const s = {
  pageTitle: { fontSize: 24, fontWeight: 800, color: theme.text, letterSpacing: '-0.5px', marginBottom: 4 },
  pageSub: { fontSize: 14, color: theme.textMuted, marginBottom: 24 },
  topBar: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, justifyContent: 'flex-end' },
  selectStyle: { padding: '7px 12px', border: `1px solid ${theme.borderSoft}`, background: theme.bg, color: theme.text, borderRadius: 8, fontSize: 13 },
  btn: (c) => ({
    background: c || theme.surfaceAlt, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 8,
    padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
  }),
  twoCol: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 },
  card: { background: theme.panelGradient, borderRadius: 14, padding: 24, border: `1px solid ${theme.border}`, boxShadow: theme.shadowGlow },
  cardTitle: { fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 },
  section: { marginBottom: 18 },
  sectionLabel: { fontSize: 12, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  text: { fontSize: 13, color: theme.textSoft, lineHeight: 1.7 },
  riskPill: (r) => ({
    display: 'inline-block', padding: '6px 18px', borderRadius: 20, fontWeight: 800, fontSize: 15,
    background: RISK_BG[r] || RISK_BG.INSUFFICIENT_DATA,
    color: RISK_COLORS[r] || theme.textMuted,
    border: `1.5px solid ${RISK_COLORS[r] || theme.border}`,
    marginBottom: 12
  }),
  probRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${theme.border}` },
  probBarWrap: { flex: 1, margin: '0 12px', background: theme.surfaceAlt, borderRadius: 6, height: 8 },
  probBar: (p, r) => ({ height: 8, width: `${Math.round(p * 100)}%`, background: RISK_COLORS[r] || theme.textMuted, borderRadius: 6, minWidth: 3, transition: 'width 0.5s ease' }),
  redFlag: { background: theme.coralBg, border: `1px solid ${theme.coralDeep}`, borderRadius: 8, padding: '10px 14px', marginBottom: 8, color: theme.coral, fontSize: 13 },
  escalation: { background: theme.amberBg, border: `1px solid ${theme.amberDeep}`, borderRadius: 10, padding: '12px 16px', fontSize: 13, color: theme.amber, lineHeight: 1.7, marginBottom: 12 },
  disclaimer: { background: theme.surfaceGradient, borderRadius: 8, padding: '10px 16px', fontSize: 11, color: theme.textMuted, lineHeight: 1.6, fontStyle: 'italic', border: `1px solid ${theme.border}` },
  preBlock: { background: theme.surfaceGradient, color: theme.textMuted, borderRadius: 10, padding: 20, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', border: `1px solid ${theme.border}` },
  forecastDay: { flex: 1, background: theme.surfaceGradient, borderRadius: 10, padding: '14px 8px', textAlign: 'center', border: `1px solid ${theme.border}`, boxShadow: theme.shadowSoft },
  forecastVal: { fontSize: 24, fontWeight: 800, color: theme.text },
  forecastLabel: { fontSize: 11, color: theme.textMuted, marginTop: 4 },
  aiBtn: { width: '100%', background: `linear-gradient(135deg, ${theme.primary}, ${theme.teal})`, color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  aiCard: { background: theme.panelGradient, border: `1px solid ${theme.teal}`, borderRadius: 14, padding: 24, marginTop: 16, boxShadow: theme.shadowGlow },
  aiTitle: { fontSize: 11, fontWeight: 700, color: theme.teal, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 },
  sensorGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 },
  sensorMetric: { background: theme.surfaceGradient, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '12px 10px', textAlign: 'center', boxShadow: theme.shadowSoft },
  sensorMetricVal: { fontSize: 18, fontWeight: 800, color: theme.text },
  sensorMetricLabel: { fontSize: 10, color: theme.textMuted, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.8 },
  sensorMeta: { fontSize: 12, color: theme.textMuted, marginBottom: 8 },
  sensorAlert: { background: theme.amberBg, border: `1px solid ${theme.amberDeep}`, borderRadius: 8, padding: '8px 10px', color: theme.amber, fontSize: 12, marginBottom: 8 },
  loading: { padding: 60, textAlign: 'center', color: theme.textMuted }
};

export default function ClinicianView({ patient }) {
  const { t } = useLang();
  const [summary, setSummary] = useState(null);
  const [risk, setRisk] = useState(null);
  const [loading, setLoading] = useState(false);
  const [windowDays, setWindowDays] = useState(7);
  const [aiReport, setAiReport] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [sensorSummary, setSensorSummary] = useState(null);
  const [latestLifestyleContext, setLatestLifestyleContext] = useState(null);
  const sensorMetricKeys = DISEASE_SENSOR_METRICS[patient.disease] || ['heart_rate_avg', 'hrv_rmssd', 'activity_load', 'recovery_score'];
  const displayRiskLabel = (risk) => t.riskDisplayLabels?.[risk] || risk;

  const load = async () => {
    setLoading(true);
    try {
      const [sumRes, riskRes] = await Promise.all([
        generateSummary(patient.id, windowDays),
        predictRisk(patient.id)
      ]);
      setSummary(sumRes.data);
      setRisk(riskRes.data);
      try {
        const entriesRes = await getEntries(patient.id, 1);
        setLatestLifestyleContext(entriesRes.data?.[0]?.lifestyle_context || null);
      } catch (entryErr) {
        setLatestLifestyleContext(null);
      }
      try {
        const sensorRes = await getSensorSummary(patient.id);
        setSensorSummary(sensorRes.data?.linked ? sensorRes.data : null);
      } catch (sensorErr) {
        setSensorSummary(null);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [patient.id, windowDays]);

  const printSummary = () => {
    const txt = summary?.structured_text || t.noSummaryAvailable;
    const win = window.open('', '_blank');
    win.document.write(`<pre style="font-family:monospace;font-size:13px;line-height:1.7;padding:20px">${txt}</pre>`);
    win.print();
  };

  const handleGenerateAiExplainer = async () => {
    if (!summary?.primary_deviations?.length) return;
    setLoadingAi(true); setAiReport('');
    try {
      const res = await generateAiExplainer(patient.id, summary.disease_name, summary.primary_deviations);
      setAiReport(res.data.report_text);
    } catch (e) {
      setAiReport(t.aiExplainerError);
    } finally { setLoadingAi(false); }
  };

  const lifestyleFieldLabels = {
    sleep_duration_hours: t.sleepDurationLabel,
    sleep_disruption: t.sleepDisruptionLabel,
    activity_level: t.activityLevelLabel,
    overexertion: t.overexertionLabel,
    activity_worsened_symptoms: t.activityWorsenedLabel,
    mentally_demanding_day: t.mentallyDemandingLabel,
    emotional_strain_note: t.emotionalStrainLabel,
    hydration_level: t.hydrationLabel,
    large_or_unusual_meals: t.unusualMealsLabel,
    missed_meals: t.missedMealsLabel,
    heat_exposure: t.heatExposureLabel,
    cold_exposure: t.coldExposureLabel,
    illness_symptoms: t.illnessSymptomsLabel,
    travel_or_routine_change: t.travelChangeLabel,
  };

  const formatLifestyleValue = (key, value) => {
    if (value === null || value === undefined || value === '') return null;
    if (key === 'sleep_duration_hours' && typeof value === 'number') return t.sleepDurationHours(value);
    if (value === 'yes') return t.choiceYes;
    if (value === 'no') return t.choiceNo;
    if (value === 'unsure') return t.choiceUnsure;
    if (value === 'low') return t.choiceLow;
    if (value === 'moderate') return t.choiceModerate;
    if (value === 'high') return t.choiceHigh;
    if (value === 'adequate') return t.choiceAdequate;
    return value;
  };

  const lifestyleItems = latestLifestyleContext
    ? Object.entries(latestLifestyleContext)
        .map(([key, value]) => ({
          key,
          label: lifestyleFieldLabels[key],
          value: formatLifestyleValue(key, value),
        }))
        .filter((item) => item.label && item.value)
    : [];

  if (loading && !summary) return <div style={s.loading}>{t.generatingClinical}</div>;

  return (
    <div>
      <div style={s.pageTitle}>{t.clinicianTitle}</div>
      <div style={s.pageSub}>{t.clinicianSub(patient.disease)}</div>

      <div style={s.topBar}>
        <select value={windowDays} onChange={e => setWindowDays(Number(e.target.value))} style={s.selectStyle}>
          {[3, 7, 14, 30].map(d => <option key={d} value={d}>{t.clinicianWindowDays(d)}</option>)}
        </select>
        <button style={s.btn()} onClick={load} disabled={loading}>
          {loading ? '⏳' : '⟳'} {t.refreshBtn}
        </button>
        <button style={{ ...s.btn(), background: theme.surfaceAlt }} onClick={printSummary}>
          {t.printBtn}
        </button>
      </div>

      <div style={s.twoCol}>
        {/* Left — Summary */}
        <div>
          {summary && (
            <div style={s.card}>
              <div style={s.cardTitle}>
                {summary.is_ai_generated ? t.aiSummaryTitle : t.structuredBrief} — {summary.disease_name}
              </div>
              <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 16 }}>
                {t.generatedAt} {new Date(summary.generated_at).toLocaleString()}
              </div>

              {summary.risk_category && (
                <div style={s.section}>
                  <div style={s.sectionLabel}>{t.riskCategory}</div>
                  <span style={s.riskPill(summary.risk_category)}>{displayRiskLabel(summary.risk_category)}</span>
                </div>
              )}

              {summary.is_ai_generated ? (
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: theme.textSoft, fontSize: 13 }}>
                  {summary.structured_text}
                </div>
              ) : (
                <>
                  {summary.primary_deviations?.length > 0 && (
                    <div style={s.section}>
                      <div style={s.sectionLabel}>{t.signalDeviations}</div>
                      {summary.primary_deviations.map((d, i) => <div key={i} style={s.text}>• {d}</div>)}
                    </div>
                  )}
                  {summary.trajectory_statement && (
                    <div style={s.section}>
                      <div style={s.sectionLabel}>{t.trajectory}</div>
                      <div style={s.text}>{summary.trajectory_statement}</div>
                    </div>
                  )}
                  {summary.volatility_statement && (
                    <div style={s.section}>
                      <div style={s.sectionLabel}>{t.volatility}</div>
                      <div style={s.text}>{summary.volatility_statement}</div>
                    </div>
                  )}
                  {summary.trigger_statement && (
                    <div style={s.section}>
                      <div style={s.sectionLabel}>{t.triggerAssoc}</div>
                      <div style={s.text}>{summary.trigger_statement}</div>
                    </div>
                  )}
                  {summary.functional_impact_statement && (
                    <div style={s.section}>
                      <div style={s.sectionLabel}>{t.functionalImpact}</div>
                      <div style={s.text}>{summary.functional_impact_statement}</div>
                    </div>
                  )}
                  {summary.confidence_statement && (
                    <div style={s.section}>
                      <div style={s.sectionLabel}>{t.dataConfidence}</div>
                      <div style={s.text}>{summary.confidence_statement}</div>
                    </div>
                  )}
                  {summary.red_flags?.length > 0 && (
                    <div style={s.section}>
                      <div style={s.sectionLabel}>{t.redFlags}</div>
                      {summary.red_flags.map((rf, i) => <div key={i} style={s.redFlag}>⚠ {rf}</div>)}
                    </div>
                  )}
                  {summary.escalation_guidance && (
                    <div style={s.section}>
                      <div style={s.sectionLabel}>{t.escalationGuidance}</div>
                      <div style={s.escalation}>{summary.escalation_guidance}</div>
                    </div>
                  )}
                  <div style={s.disclaimer}>{summary.scope_disclaimer}</div>

                  {summary.primary_deviations && summary.primary_deviations[0] !== 'All symptoms within personal baseline range.' && (
                    <button style={s.aiBtn} onClick={handleGenerateAiExplainer} disabled={loadingAi}>
                      {loadingAi ? t.generatingAi : t.generateAiBtn}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {aiReport && (
            <div style={s.aiCard}>
              <div style={s.aiTitle}><span>✨</span> {t.aiReportTitle}</div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: theme.textSoft, fontSize: 13 }}>
                {aiReport}
              </div>
            </div>
          )}
        </div>

        {/* Right — Risk + Forecast */}
        <div>
          {risk && (
            <>
              <div style={{ ...s.card, marginBottom: 16 }}>
                <div style={s.cardTitle}>{t.riskProbs}</div>
                {Object.entries(risk.risk_probabilities || {}).map(([cat, prob]) => (
                  <div key={cat} style={s.probRow}>
                    <span style={{ fontSize: 12, fontWeight: 700, width: 90, color: RISK_COLORS[cat] }}>{displayRiskLabel(cat)}</span>
                    <div style={s.probBarWrap}>
                      <div style={s.probBar(prob, cat)} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: theme.textSoft, width: 36, textAlign: 'right' }}>
                      {(prob * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>

              {lifestyleItems.length > 0 && (
                <div style={{ ...s.card, marginBottom: 16 }}>
                  <div style={s.cardTitle}>{t.contextLatestTitle}</div>
                  <div style={s.sensorMeta}>{t.contextLatestSub}</div>
                  {lifestyleItems.map((item) => (
                    <div key={item.key} style={s.probRow}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, paddingRight: 12 }}>{item.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: theme.textSoft, textAlign: 'right' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {sensorSummary && (
                <div style={{ ...s.card, marginBottom: 16 }}>
                  <div style={s.cardTitle}>{t.wearableInsightsTitle}</div>
                  <div style={s.sensorMeta}>{t.wearableInsightsSub}</div>
                  <div style={s.sensorMeta}>
                    {sensorSummary.device_type || t.wearableGenericDevice} • {t.wearableSource}: {sensorSummary.stream_source}
                  </div>
                  <div style={s.sensorMeta}>
                    {t.wearableCollected}: {sensorSummary.collected_at ? new Date(sensorSummary.collected_at).toLocaleString() : t.notAvailable} • {t.wearableQuality}: {sensorSummary.signal_quality}
                  </div>
                  <div style={s.sensorGrid}>
                    {sensorMetricKeys.map((metricKey) => {
                      const config = SENSOR_METRIC_CONFIG[metricKey];
                      const value = sensorSummary[metricKey];
                      return (
                        <div key={metricKey} style={s.sensorMetric}>
                          <div style={s.sensorMetricVal}>
                            {typeof value === 'number' ? value.toFixed(config.digits) : '—'}
                          </div>
                          <div style={s.sensorMetricLabel}>{t.wearableMetrics[config.labelKey]}</div>
                        </div>
                      );
                    })}
                  </div>
                  {sensorSummary.insights?.map((insight, idx) => (
                    <div key={idx} style={{ ...s.text, marginBottom: 8 }}>• {insight}</div>
                  ))}
                  <div style={{ ...s.sectionLabel, marginTop: 14 }}>{t.wearableAlerts}</div>
                  {sensorSummary.alerts?.length ? (
                    sensorSummary.alerts.map((alert, idx) => <div key={idx} style={s.sensorAlert}>{alert}</div>)
                  ) : (
                    <div style={s.text}>{t.wearableNoAlerts}</div>
                  )}
                </div>
              )}

              {risk.forecast_3d?.length > 0 && (
                <div style={s.card}>
                  <div style={s.cardTitle}>{t.forecastTitle}</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {risk.forecast_3d.map((val, i) => (
                      <div key={i} style={s.forecastDay}>
                        <div style={s.forecastVal}>{(val * 10).toFixed(1)}</div>
                        <div style={s.forecastLabel}>Day +{i + 1}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: theme.textMeta, marginTop: 12, fontStyle: 'italic', textAlign: 'center' }}>
                    {t.forecastDisclaimer}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {summary?.structured_text && !summary.is_ai_generated && (
        <div style={s.card}>
          <div style={s.cardTitle}>{t.rawOutputTitle}</div>
          <div style={s.preBlock}>{summary.structured_text}</div>
        </div>
      )}
    </div>
  );
}
