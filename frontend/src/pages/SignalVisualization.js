// src/pages/SignalVisualization.js — Charts for baseline, volatility, FIS radar
import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, ReferenceLine
} from 'recharts';
import { computeSignals, getHistory } from '../api';

const RISK_COLORS = { LOW: '#10b981', MODERATE: '#f59e0b', HIGH: '#ef4444', CRITICAL: '#b91c1c', INSUFFICIENT_DATA: '#64748b' };

const s = {
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 },
  card: { background: '#1e293b', borderRadius: 12, padding: 24, border: '1px solid #334155', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', color: '#f8fafc' },
  title: { fontSize: 16, fontWeight: 700, color: '#f8fafc', marginBottom: 16 },
  riskBadge: (r) => ({ display: 'inline-block', padding: '4px 14px', borderRadius: 20, fontWeight: 700, fontSize: 14, background: RISK_COLORS[r] || '#475569', color: '#fff' }),
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 },
  stat: { background: '#1e293b', borderRadius: 10, padding: '16px 20px', border: '1px solid #334155', textAlign: 'center' },
  statVal: { fontSize: 28, fontWeight: 800, color: '#60a5fa' },
  statLabel: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  refreshBtn: { background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 20 },
  loading: { padding: 60, textAlign: 'center', color: '#94a3b8' },
  zRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #334155' },
  zName: { fontSize: 13, color: '#e2e8f0', textTransform: 'capitalize' },
  zVal: (v) => ({ fontWeight: 700, fontSize: 14, color: Math.abs(v) >= 2 ? '#fca5a5' : Math.abs(v) >= 1 ? '#fcd34d' : '#86efac' }),
  noData: { textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: 14 }
};

export default function SignalVisualization({ patient }) {
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

  if (loading && !signals) return <div style={s.loading}>Computing signals...</div>;

  const fis = signals?.functional_impact || {};
  const radarData = [
    { domain: 'Mobility', value: Math.round((fis.mobility || 0) * 100) },
    { domain: 'Cognitive', value: Math.round((fis.cognitive || 0) * 100) },
    { domain: 'Sleep', value: Math.round((fis.sleep || 0) * 100) },
    { domain: 'Work', value: Math.round((fis.work || 0) * 100) },
    { domain: 'Social', value: Math.round((fis.social || 0) * 100) }
  ];

  const zScoreData = signals ? Object.entries(signals.z_scores || {}).map(([sym, d]) => ({
    name: sym.replace(/_/g, ' ').slice(0, 16),
    z: parseFloat(d.z_score?.toFixed(2) || 0),
    current: parseFloat(d.value?.toFixed(1) || 0),
    baseline: parseFloat(d.baseline_mu?.toFixed(1) || 0)
  })) : [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, color: '#f8fafc' }}>Signal Dashboard — {patient.disease}</h2>
        <button style={s.refreshBtn} onClick={refresh} disabled={loading}>
          {loading ? '⟳ Refreshing...' : '⟳ Refresh Signals'}
        </button>
      </div>

      {/* Stats Row */}
      {signals && (
        <div style={s.statGrid}>
          <div style={s.stat}>
            <div style={s.statVal}>{signals.volatility?.value?.toFixed(2) || '—'}</div>
            <div style={s.statLabel}>Volatility Index</div>
            <div style={{ fontSize: 11, color: { high: '#fca5a5', moderate: '#fcd34d', low: '#86efac' }[signals.volatility?.label] || '#94a3b8', marginTop: 4, fontWeight: 700 }}>{(signals.volatility?.label || '—').toUpperCase()}</div>
          </div>
          <div style={s.stat}>
            <div style={s.statVal}>{fis.composite ? (fis.composite * 100).toFixed(0) + '%' : '—'}</div>
            <div style={s.statLabel}>Functional Impact</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{fis.severity_label?.toUpperCase()}</div>
          </div>
          <div style={s.stat}>
            <div style={{ ...s.statVal }}>
              <span style={s.riskBadge(signals.risk_category)}>{signals.risk_category}</span>
            </div>
            <div style={s.statLabel}>Risk Category</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{signals.missingness?.completeness_pct?.toFixed(0)}% complete</div>
          </div>
        </div>
      )}

      <div style={s.grid}>
        {/* Z-Score Bar Chart */}
        <div style={s.card}>
          <div style={s.title}>Symptom Deviation from Baseline (σ)</div>
          {zScoreData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={zScoreData} layout="vertical" margin={{ left: 80, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[-4, 4]} tickCount={9} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}σ`, 'Z-Score']} />
                <ReferenceLine x={0} stroke="#f8fafc" strokeWidth={2} />
                <ReferenceLine x={2} stroke="#fca5a5" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: '+2σ', position: 'top', fontSize: 10, fill: '#f8fafc' }} />
                <ReferenceLine x={-2} stroke="#fca5a5" strokeDasharray="4 2" strokeWidth={1.5} />
                <Bar dataKey="z" name="Z-Score" fill="#60a5fa" radius={[0, 3, 3, 0]}
                  label={{ position: 'right', fontSize: 10, fill: '#f8fafc', formatter: v => v > 0 ? `+${v}` : v }} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={s.noData}>Log symptoms to see deviations</div>}
        </div>

        {/* FIS Radar */}
        <div style={s.card}>
          <div style={s.title}>Functional Impact Score by Domain</div>
          {fis.composite > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={80}>
                <PolarGrid />
                <PolarAngleAxis dataKey="domain" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar name="FIS" dataKey="value" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.35} />
                <Tooltip formatter={(v) => [`${v}%`, 'Impact']} />
              </RadarChart>
            </ResponsiveContainer>
          ) : <div style={s.noData}>No functional impact data yet</div>}
        </div>

        {/* Longitudinal History */}
        <div style={{ ...s.card, gridColumn: 'span 2' }}>
          <div style={s.title}>Signal History — Volatility & Max Z-Score Over Time</div>
          {history.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" domain={[0, 4]} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 1]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <ReferenceLine yAxisId="left" y={2} stroke="#fca5a5" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: '2σ threshold', fontSize: 10, fill: '#fca5a5' }} />
                <Line yAxisId="left" type="monotone" dataKey="z_score_max" name="Max Z-Score" stroke="#fca5a5" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="volatility_index" name="Volatility Index" stroke="#fcd34d" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="fis_composite" name="FIS Composite" stroke="#60a5fa" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <div style={s.noData}>Longitudinal history will appear here after multiple logging sessions</div>}
        </div>
      </div>

      {/* Trigger Correlations */}
      {signals?.trigger_correlations?.length > 0 && (
        <div style={s.card}>
          <div style={s.title}>Trigger Association Analysis (Spearman Correlation)</div>
          {signals.trigger_correlations.map((tc, i) => (
            <div key={i} style={s.zRow}>
              <span style={s.zName}>{tc.trigger.replace(/_/g, ' ')}</span>
              <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {tc.significant && <span style={{ fontSize: 11, background: '#451a03', color: '#fde047', padding: '2px 8px', borderRadius: 10 }}>Significant</span>}
                <span style={s.zVal(tc.correlation)}>r = {tc.correlation > 0 ? '+' : ''}{tc.correlation.toFixed(3)}</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>p={tc.p_value.toFixed(3)}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {signals?.red_flags?.length > 0 && (
        <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 10, padding: '16px 20px', marginTop: 16 }}>
          <div style={{ fontWeight: 700, color: '#fca5a5', marginBottom: 8 }}>⚠ Red Flags Detected</div>
          {signals.red_flags.map((rf, i) => <div key={i} style={{ color: '#f87171', fontSize: 14 }}>• {rf.replace(/_/g, ' ')}</div>)}
          <div style={{ fontSize: 12, color: '#fca5a5', marginTop: 10, fontStyle: 'italic' }}>This is not medical advice. If concerned, contact your care team.</div>
        </div>
      )}
    </div>
  );
}
