// src/pages/ClinicianView.js — Structured summary for clinicians
import React, { useState, useEffect } from 'react';
import { generateSummary, predictRisk, getHistory } from '../api';

const RISK_COLORS = { LOW: '#10b981', MODERATE: '#f59e0b', HIGH: '#ef4444', CRITICAL: '#b91c1c', INSUFFICIENT_DATA: '#64748b' };

const s = {
  twoCol: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 },
  card: { background: '#1e293b', borderRadius: 12, padding: 24, border: '1px solid #334155', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', color: '#f8fafc' },
  title: { fontSize: 16, fontWeight: 700, color: '#f8fafc', marginBottom: 16 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  text: { fontSize: 14, color: '#cbd5e1', lineHeight: 1.6 },
  riskBadge: (r) => ({ display: 'inline-block', padding: '6px 18px', borderRadius: 20, fontWeight: 700, fontSize: 16, background: RISK_COLORS[r] || '#475569', color: '#fff', marginBottom: 12 }),
  probRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #334155' },
  probBar: (p, r) => ({ height: 12, width: `${Math.round(p * 100)}%`, background: RISK_COLORS[r] || '#475569', borderRadius: 6, minWidth: 4 }),
  redFlag: { background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8, padding: '10px 16px', marginBottom: 8, color: '#fca5a5', fontSize: 14 },
  escalation: { background: '#451a03', border: '1px solid #78350f', borderRadius: 8, padding: '12px 16px', fontSize: 14, color: '#fcd34d', lineHeight: 1.6, marginBottom: 12 },
  disclaimer: { background: '#0f172a', borderRadius: 8, padding: '10px 16px', fontSize: 12, color: '#94a3b8', lineHeight: 1.6, fontStyle: 'italic', border: '1px solid #334155' },
  preBlock: { background: '#020617', color: '#bae6fd', borderRadius: 10, padding: 20, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', border: '1px solid #334155' },
  btn: { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginRight: 10 },
  printBtn: { background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  forecastBar: { display: 'flex', gap: 10, marginTop: 8 },
  forecastDay: { flex: 1, background: '#0f172a', borderRadius: 8, padding: '12px 8px', textAlign: 'center', border: '1px solid #334155' },
  forecastVal: { fontSize: 22, fontWeight: 700, color: '#f8fafc' },
  forecastLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  loading: { padding: 60, textAlign: 'center', color: '#94a3b8' }
};

export default function ClinicianView({ patient }) {
  const [summary, setSummary] = useState(null);
  const [risk, setRisk] = useState(null);
  const [loading, setLoading] = useState(false);
  const [windowDays, setWindowDays] = useState(7);

  const load = async () => {
    setLoading(true);
    try {
      const [sumRes, riskRes] = await Promise.all([
        generateSummary(patient.id, windowDays),
        predictRisk(patient.id)
      ]);
      setSummary(sumRes.data);
      setRisk(riskRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [patient.id, windowDays]);

  const printSummary = () => {
    const txt = summary?.structured_text || 'No summary available.';
    const win = window.open('', '_blank');
    win.document.write(`<pre style="font-family:monospace;font-size:13px;line-height:1.7;padding:20px">${txt}</pre>`);
    win.print();
  };

  if (loading && !summary) return <div style={s.loading}>Generating clinical summary...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, color: '#f8fafc' }}>Clinician View — {patient.disease}</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={windowDays} onChange={e => setWindowDays(Number(e.target.value))} style={{ padding: '7px 12px', border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', borderRadius: 6, fontSize: 13 }}>
            {[3, 7, 14, 30].map(d => <option key={d} value={d}>Last {d} days</option>)}
          </select>
          <button style={s.btn} onClick={load} disabled={loading}>{loading ? 'Loading...' : '⟳ Refresh'}</button>
          <button style={s.printBtn} onClick={printSummary}>🖨 Print Summary</button>
        </div>
      </div>

      <div style={s.twoCol}>
        {/* Structured Summary */}
        <div>
          {summary && (
            <div style={s.card}>
              <div style={s.title}>{summary.is_ai_generated ? "✨ AI Clinical Summary" : "Structured Signal Brief"} — {summary.disease_name}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Generated: {new Date(summary.generated_at).toLocaleString()}</div>

              {summary.risk_category && (
                <div style={s.section}>
                  <div style={s.sectionTitle}>Risk Category</div>
                  <span style={s.riskBadge(summary.risk_category)}>{summary.risk_category}</span>
                </div>
              )}

              {summary.is_ai_generated ? (
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, color: '#cbd5e1', fontSize: 14 }}>
                  {summary.structured_text}
                </div>
              ) : (
                <>
                  {summary.primary_deviations?.length > 0 && (
                    <div style={s.section}>
                      <div style={s.sectionTitle}>Signal Deviations</div>
                      {summary.primary_deviations.map((d, i) => <div key={i} style={s.text}>• {d}</div>)}
                    </div>
                  )}

                  {summary.trajectory_statement && (
                    <div style={s.section}>
                      <div style={s.sectionTitle}>Trajectory</div>
                      <div style={s.text}>{summary.trajectory_statement}</div>
                    </div>
                  )}

                  {summary.volatility_statement && (
                    <div style={s.section}>
                      <div style={s.sectionTitle}>Volatility</div>
                      <div style={s.text}>{summary.volatility_statement}</div>
                    </div>
                  )}

                  {summary.trigger_statement && (
                    <div style={s.section}>
                      <div style={s.sectionTitle}>Trigger Associations</div>
                      <div style={s.text}>{summary.trigger_statement}</div>
                    </div>
                  )}

                  {summary.functional_impact_statement && (
                    <div style={s.section}>
                      <div style={s.sectionTitle}>Functional Impact</div>
                      <div style={s.text}>{summary.functional_impact_statement}</div>
                    </div>
                  )}

                  {summary.confidence_statement && (
                    <div style={s.section}>
                      <div style={s.sectionTitle}>Data Confidence</div>
                      <div style={s.text}>{summary.confidence_statement}</div>
                    </div>
                  )}

                  {summary.red_flags?.length > 0 && (
                    <div style={s.section}>
                      <div style={s.sectionTitle}>⚠ Red Flags</div>
                      {summary.red_flags.map((rf, i) => <div key={i} style={s.redFlag}>⚠ {rf}</div>)}
                    </div>
                  )}

                  {summary.escalation_guidance && (
                    <div style={s.section}>
                      <div style={s.sectionTitle}>Escalation Guidance</div>
                      <div style={s.escalation}>{summary.escalation_guidance}</div>
                    </div>
                  )}

                  <div style={s.disclaimer}>{summary.scope_disclaimer}</div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Risk + Forecast */}
        <div>
          {risk && (
            <>
              <div style={{ ...s.card, marginBottom: 20 }}>
                <div style={s.title}>Risk Probabilities</div>
                {Object.entries(risk.risk_probabilities || {}).map(([cat, prob]) => (
                  <div key={cat} style={s.probRow}>
                    <span style={{ fontSize: 13, fontWeight: 600, width: 90, color: RISK_COLORS[cat] }}>{cat}</span>
                    <div style={{ flex: 1, margin: '0 12px', background: '#f0f4f8', borderRadius: 6, height: 12 }}>
                      <div style={s.probBar(prob, cat)} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', width: 42, textAlign: 'right' }}>{(prob * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>

              {risk.forecast_3d?.length > 0 && (
                <div style={s.card}>
                  <div style={s.title}>3-Day Forecast</div>
                  <div style={s.forecastBar}>
                    {risk.forecast_3d.map((val, i) => (
                      <div key={i} style={s.forecastDay}>
                        <div style={s.forecastVal}>{(val * 10).toFixed(1)}</div>
                        <div style={s.forecastLabel}>Day +{i + 1}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 10, fontStyle: 'italic' }}>Mean-reverting forecast. Not a clinical prediction.</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Raw structured text fallback for prints */}
      {summary?.structured_text && !summary.is_ai_generated && (
        <div style={s.card}>
          <div style={s.title}>Raw Structured Output (Export Format)</div>
          <div style={s.preBlock}>{summary.structured_text}</div>
        </div>
      )}
    </div>
  );
}
