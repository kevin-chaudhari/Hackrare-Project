// src/pages/PatientDashboard.js — Daily symptom entry
import React, { useState, useEffect } from 'react';
import { addEntry, getDiseaseConfig, computeSignals } from '../api';

const TRIGGERS_DISPLAY = {
  dehydration: 'Dehydration', heat_exposure: 'Heat Exposure', prolonged_standing: 'Prolonged Standing',
  stress: 'Stress', sleep_deprivation: 'Sleep Deprivation', alcohol: 'Alcohol',
  large_meals: 'Large Meals', exercise: 'Exercise', overexertion: 'Overexertion',
  weather_change: 'Weather Change', hormonal_changes: 'Hormonal Changes',
  infection: 'Infection', cold_weather: 'Cold Weather', allergens: 'Allergens',
  smoke_exposure: 'Smoke Exposure', dry_environment: 'Dry Environment',
  nasal_spray_use: 'Nasal Spray Use', exertion: 'Exertion', altitude: 'Altitude',
  illness: 'Illness'
};

const s = {
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  card: { background: '#1e293b', borderRadius: 12, padding: 24, border: '1px solid #334155', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', color: '#f8fafc' },
  title: { fontSize: 18, fontWeight: 700, color: '#f8fafc', marginBottom: 16 },
  sliderRow: { marginBottom: 18 },
  sliderLabel: { display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 },
  sliderName: { fontWeight: 600, color: '#e2e8f0' },
  sliderVal: (v) => ({ fontWeight: 700, color: v >= 7 ? '#fca5a5' : v >= 4 ? '#fcd34d' : '#86efac', fontSize: 15, minWidth: 28, textAlign: 'right' }),
  slider: { width: '100%', accentColor: '#3b82f6' },
  triggerGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  triggerBtn: (active) => ({ padding: '8px 10px', border: `1px solid ${active ? '#3b82f6' : '#475569'}`, borderRadius: 8, background: active ? '#1e3a8a' : '#0f172a', fontSize: 12, fontWeight: active ? 700 : 400, cursor: 'pointer', color: active ? '#bfdbfe' : '#cbd5e1', textAlign: 'left', transition: 'all 0.12s' }),
  textarea: { width: '100%', border: '1px solid #475569', borderRadius: 8, padding: '10px 12px', fontSize: 14, resize: 'vertical', minHeight: 80, boxSizing: 'border-box', background: '#0f172a', color: '#f8fafc' },
  submitBtn: { marginTop: 20, width: '100%', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '13px 0', fontSize: 16, fontWeight: 700, cursor: 'pointer' },
  success: { background: '#14532d', color: '#86efac', borderRadius: 8, padding: '10px 16px', marginTop: 12, fontSize: 14 },
  error: { background: '#7f1d1d', color: '#fca5a5', borderRadius: 8, padding: '10px 16px', marginTop: 12, fontSize: 14 },
  disclaimer: { fontSize: 11, color: '#64748b', marginTop: 16, fontStyle: 'italic', lineHeight: 1.5 }
};

export default function PatientDashboard({ patient }) {
  const [config, setConfig] = useState(null);
  const [symptoms, setSymptoms] = useState({});
  const [triggers, setTriggers] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    getDiseaseConfig(patient.disease).then(res => {
      setConfig(res.data);
      const initial = {};
      res.data.symptoms.forEach(s => { initial[s] = 5.0; });
      setSymptoms(initial);
    }).catch(() => { });
  }, [patient.disease]);

  const toggleTrigger = (t) => {
    setTriggers(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const handleSubmit = async () => {
    setLoading(true); setMsg(null);
    try {
      await addEntry({
        patient_id: patient.id,
        symptoms,
        triggers,
        notes: notes || null
      });
      // Auto-compute signals after entry
      await computeSignals(patient.id, 7);
      setMsg({ type: 'success', text: '✓ Entry saved & signals updated.' });
      setNotes('');
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || 'Failed to save entry.' });
    } finally {
      setLoading(false);
    }
  };

  if (!config) return <div style={{ padding: 40, color: '#94a3b8' }}>Loading disease configuration...</div>;

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', color: '#f8fafc' }}>Daily Check-In — {patient.disease}</h2>
      <div style={s.grid}>
        {/* Symptom Sliders */}
        <div style={s.card}>
          <div style={s.title}>Symptom Severity (0 = none, 10 = severe)</div>
          {config.symptoms.map(sym => (
            <div key={sym} style={s.sliderRow}>
              <div style={s.sliderLabel}>
                <span style={s.sliderName}>{config.symptom_labels?.[sym] || sym.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                <span style={s.sliderVal(symptoms[sym])}>{symptoms[sym]?.toFixed(1)}</span>
              </div>
              <input
                type="range" min={0} max={10} step={0.5}
                style={s.slider}
                value={symptoms[sym] || 5}
                onChange={e => setSymptoms(prev => ({ ...prev, [sym]: parseFloat(e.target.value) }))}
              />
            </div>
          ))}
        </div>

        {/* Triggers + Notes */}
        <div>
          <div style={{ ...s.card, marginBottom: 20 }}>
            <div style={s.title}>Triggers Today</div>
            <div style={s.triggerGrid}>
              {config.triggers.map(t => (
                <button key={t} style={s.triggerBtn(triggers.includes(t))} onClick={() => toggleTrigger(t)}>
                  {triggers.includes(t) ? '✓ ' : ''}{TRIGGERS_DISPLAY[t] || t.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
          <div style={s.card}>
            <div style={s.title}>Notes (optional)</div>
            <textarea
              style={s.textarea}
              placeholder="Any additional observations..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
            <button style={s.submitBtn} onClick={handleSubmit} disabled={loading}>
              {loading ? 'Saving...' : 'Save Entry & Update Signals'}
            </button>
            {msg && <div style={s[msg.type]}>{msg.text}</div>}
            <div style={s.disclaimer}>
              This tool does not provide medical advice. All data is for documentation and signal generation only.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
