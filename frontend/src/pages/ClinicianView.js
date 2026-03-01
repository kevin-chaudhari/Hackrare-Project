import React, { useState, useEffect } from 'react';
import { generateSummary, predictRisk, generateAiExplainer } from '../api';
import { useLang } from '../i18n/LanguageContext';

const RISK_COLORS = {
  LOW: '#3fb950', MODERATE: '#d29922', HIGH: '#f85149', CRITICAL: '#8b0000', INSUFFICIENT_DATA: '#484f58'
};
const RISK_BG = {
  LOW: 'rgba(63,185,80,0.1)', MODERATE: 'rgba(210,153,34,0.1)', HIGH: 'rgba(248,81,73,0.1)', CRITICAL: 'rgba(139,0,0,0.15)', INSUFFICIENT_DATA: 'rgba(72,79,88,0.2)'
};

const s = {
  pageTitle: { fontSize: 24, fontWeight: 800, color: '#e6edf3', letterSpacing: '-0.5px', marginBottom: 4 },
  pageSub: { fontSize: 14, color: '#484f58', marginBottom: 24 },
  topBar: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, justifyContent: 'flex-end' },
  selectStyle: { padding: '7px 12px', border: '1px solid #30363d', background: '#0d1117', color: '#e6edf3', borderRadius: 8, fontSize: 13 },
  btn: (c) => ({
    background: c || '#21262d', color: '#e6edf3', border: '1px solid #30363d', borderRadius: 8,
    padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
  }),
  twoCol: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 },
  card: { background: '#161b22', borderRadius: 14, padding: 24, border: '1px solid #21262d' },
  cardTitle: { fontSize: 11, fontWeight: 700, color: '#484f58', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 },
  section: { marginBottom: 18 },
  sectionLabel: { fontSize: 12, fontWeight: 700, color: '#58a6ff', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  text: { fontSize: 13, color: '#c9d1d9', lineHeight: 1.7 },
  riskPill: (r) => ({
    display: 'inline-block', padding: '6px 18px', borderRadius: 20, fontWeight: 800, fontSize: 15,
    background: RISK_BG[r] || RISK_BG.INSUFFICIENT_DATA,
    color: RISK_COLORS[r] || '#484f58',
    border: `1.5px solid ${RISK_COLORS[r] || '#30363d'}`,
    marginBottom: 12
  }),
  probRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #21262d' },
  probBarWrap: { flex: 1, margin: '0 12px', background: '#21262d', borderRadius: 6, height: 8 },
  probBar: (p, r) => ({ height: 8, width: `${Math.round(p * 100)}%`, background: RISK_COLORS[r] || '#484f58', borderRadius: 6, minWidth: 3, transition: 'width 0.5s ease' }),
  redFlag: { background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 8, color: '#f85149', fontSize: 13 },
  escalation: { background: 'rgba(210,153,34,0.08)', border: '1px solid rgba(210,153,34,0.3)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#d29922', lineHeight: 1.7, marginBottom: 12 },
  disclaimer: { background: '#0d1117', borderRadius: 8, padding: '10px 16px', fontSize: 11, color: '#484f58', lineHeight: 1.6, fontStyle: 'italic', border: '1px solid #21262d' },
  preBlock: { background: '#0d1117', color: '#79c0ff', borderRadius: 10, padding: 20, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', border: '1px solid #21262d' },
  forecastDay: { flex: 1, background: '#0d1117', borderRadius: 10, padding: '14px 8px', textAlign: 'center', border: '1px solid #21262d' },
  forecastVal: { fontSize: 24, fontWeight: 800, color: '#e6edf3' },
  forecastLabel: { fontSize: 11, color: '#484f58', marginTop: 4 },
  aiBtn: { width: '100%', background: 'linear-gradient(135deg, #7c3aed, #4c1d95)', color: '#e9d5ff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  aiCard: { background: 'linear-gradient(135deg, #0d1117, #1c0d2e)', border: '1px solid #4c1d95', borderRadius: 14, padding: 24, marginTop: 16 },
  aiTitle: { fontSize: 11, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 },
  loading: { padding: 60, textAlign: 'center', color: '#484f58' }
};

export default function ClinicianView({ patient }) {
  const { t } = useLang();
  const [summary, setSummary] = useState(null);
  const [risk, setRisk] = useState(null);
  const [loading, setLoading] = useState(false);
  const [windowDays, setWindowDays] = useState(7);
  const [aiReport, setAiReport] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [sumRes, riskRes] = await Promise.all([
        generateSummary(patient.id, windowDays),
        predictRisk(patient.id)
      ]);
      setSummary(sumRes.data);
      setRisk(riskRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [patient.id, windowDays]);

  const printSummary = () => {
    const txt = summary?.structured_text || 'No summary available.';
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
      setAiReport('Failed to generate AI Explainer report.');
    } finally { setLoadingAi(false); }
  };

  if (loading && !summary) return <div style={s.loading}>{t.generatingClinical}</div>;

  return (
    <div>
      <div style={s.pageTitle}>{t.clinicianTitle}</div>
      <div style={s.pageSub}>{t.clinicianSub(patient.disease)}</div>

      <div style={s.topBar}>
        <select value={windowDays} onChange={e => setWindowDays(Number(e.target.value))} style={s.selectStyle}>
          {[3, 7, 14, 30].map(d => <option key={d} value={d}>Last {d} days</option>)}
        </select>
        <button style={s.btn()} onClick={load} disabled={loading}>
          {loading ? '⏳' : '⟳'} {t.refreshBtn}
        </button>
        <button style={{ ...s.btn(), background: '#21262d' }} onClick={printSummary}>
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
              <div style={{ fontSize: 11, color: '#484f58', marginBottom: 16 }}>
                {t.generatedAt} {new Date(summary.generated_at).toLocaleString()}
              </div>

              {summary.risk_category && (
                <div style={s.section}>
                  <div style={s.sectionLabel}>{t.riskCategory}</div>
                  <span style={s.riskPill(summary.risk_category)}>{summary.risk_category}</span>
                </div>
              )}

              {summary.is_ai_generated ? (
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: '#c9d1d9', fontSize: 13 }}>
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
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: '#c9d1d9', fontSize: 13 }}>
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
                    <span style={{ fontSize: 12, fontWeight: 700, width: 90, color: RISK_COLORS[cat] }}>{cat}</span>
                    <div style={s.probBarWrap}>
                      <div style={s.probBar(prob, cat)} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#c9d1d9', width: 36, textAlign: 'right' }}>
                      {(prob * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>

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
                  <div style={{ fontSize: 11, color: '#30363d', marginTop: 12, fontStyle: 'italic', textAlign: 'center' }}>
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
