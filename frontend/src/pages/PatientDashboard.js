// src/pages/PatientDashboard.js — Daily symptom entry (Premium UI)
import React, { useState, useEffect } from 'react';
import { addEntry, getDiseaseConfig, computeSignals } from '../api';
import { useLang } from '../i18n/LanguageContext';

const TRIGGERS_DISPLAY = {
  dehydration: 'Dehydration', heat_exposure: 'Heat Exposure', prolonged_standing: 'Prolonged Standing',
  stress: 'Stress', sleep_deprivation: 'Sleep Deprivation', alcohol: 'Alcohol',
  large_meals: 'Large Meals', exercise: 'Exercise', overexertion: 'Overexertion',
  weather_change: 'Weather Change', hormonal_changes: 'Hormonal Changes',
  infection: 'Infection', cold_weather: 'Cold Weather', allergens: 'Allergens',
  smoke_exposure: 'Smoke Exposure', dry_environment: 'Dry Environment',
  nasal_spray_use: 'Nasal Spray Use', exertion: 'Exertion', altitude: 'Altitude',
  illness: 'Illness', menstruation: 'Menstruation', cold_exposure: 'Cold Exposure',
  fatigue: 'Fatigue', medications: 'Medications'
};

const severityColor = (v) => v >= 7 ? '#f85149' : v >= 4 ? '#d29922' : '#3fb950';

const s = {
  pageTitle: { fontSize: 24, fontWeight: 800, color: '#e6edf3', letterSpacing: '-0.5px', marginBottom: 4 },
  pageSub: { fontSize: 14, color: '#484f58', marginBottom: 28 },
  grid: { display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20 },
  card: {
    background: '#161b22', borderRadius: 14, padding: 24,
    border: '1px solid #21262d', boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
  },
  cardTitle: { fontSize: 11, fontWeight: 700, color: '#484f58', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 18 },
  sliderRow: { marginBottom: 20 },
  sliderTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sliderName: { fontSize: 13, fontWeight: 600, color: '#c9d1d9' },
  sliderVal: (v) => ({
    fontSize: 13, fontWeight: 800, color: severityColor(v),
    background: `${severityColor(v)}1a`, padding: '2px 10px', borderRadius: 20
  }),
  sliderTrack: { width: '100%', accentColor: '#3fb950', height: 4, cursor: 'pointer' },
  triggerGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 },
  triggerBtn: (active) => ({
    padding: '8px 10px', border: `1px solid ${active ? '#3fb950' : '#21262d'}`,
    borderRadius: 8, background: active ? 'rgba(63,185,80,0.1)' : '#0d1117',
    fontSize: 12, fontWeight: active ? 700 : 400, cursor: 'pointer',
    color: active ? '#3fb950' : '#8b949e', textAlign: 'left', transition: 'all 0.12s'
  }),
  textarea: {
    width: '100%', border: '1px solid #30363d', borderRadius: 10, padding: '10px 14px',
    fontSize: 13, resize: 'vertical', minHeight: 80, boxSizing: 'border-box',
    background: '#0d1117', color: '#e6edf3', outline: 'none'
  },
  submitBtn: {
    marginTop: 16, width: '100%', background: 'linear-gradient(135deg, #3fb950, #1a7f37)',
    color: '#fff', border: 'none', borderRadius: 10, padding: '13px 0',
    fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
  },
  success: { background: 'rgba(63,185,80,0.1)', color: '#3fb950', border: '1px solid rgba(63,185,80,0.3)', borderRadius: 8, padding: '10px 14px', marginTop: 12, fontSize: 13 },
  error: { background: 'rgba(248,81,73,0.1)', color: '#f85149', border: '1px solid rgba(248,81,73,0.3)', borderRadius: 8, padding: '10px 14px', marginTop: 12, fontSize: 13 },
  disclaimer: { fontSize: 11, color: '#30363d', marginTop: 16, fontStyle: 'italic', lineHeight: 1.5, textAlign: 'center' },
  loading: { padding: 40, color: '#484f58', textAlign: 'center' }
};

export default function PatientDashboard({ patient }) {
  const { t } = useLang();
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
      await addEntry({ patient_id: patient.id, symptoms, triggers, notes: notes || null });
      await computeSignals(patient.id, 7);
      setMsg({ type: 'success', text: '✓ Entry saved & signals updated.' });
      setNotes('');
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || 'Failed to save entry.' });
    } finally {
      setLoading(false);
    }
  };

  if (!config) return <div style={s.loading}>{t.loadingConfig}</div>;

  return (
    <div>
      <div style={s.pageTitle}>{t.dailyTitle}</div>
      <div style={s.pageSub}>{t.dailySub(config.name || patient.disease)}</div>

      <div style={s.grid}>
        {/* Symptoms */}
        <div style={s.card}>
          <div style={s.cardTitle}>{t.symptomsTitle}</div>
          {config.symptoms.map(sym => (
            <div key={sym} style={s.sliderRow}>
              <div style={s.sliderTop}>
                <span style={s.sliderName}>
                  {config.symptom_labels?.[sym] || sym.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </span>
                <span style={s.sliderVal(symptoms[sym])}>{symptoms[sym]?.toFixed(1)}</span>
              </div>
              <input
                type="range" min={0} max={10} step={0.5}
                style={s.sliderTrack}
                value={symptoms[sym] || 5}
                onChange={e => setSymptoms(prev => ({ ...prev, [sym]: parseFloat(e.target.value) }))}
              />
            </div>
          ))}
        </div>

        {/* Right column */}
        <div>
          <div style={{ ...s.card, marginBottom: 16 }}>
            <div style={s.cardTitle}>{t.triggersTitle}</div>
            <div style={s.triggerGrid}>
              {config.triggers.map(t_item => (
                <button key={t_item} style={s.triggerBtn(triggers.includes(t_item))} onClick={() => toggleTrigger(t_item)}>
                  {triggers.includes(t_item) ? '✓ ' : ''}{t.triggers[t_item] || t_item.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
          <div style={s.card}>
            <div style={s.cardTitle}>{t.notesTitle}</div>
            <textarea
              style={s.textarea}
              placeholder={t.notesPlaceholder}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
            <button style={s.submitBtn} onClick={handleSubmit} disabled={loading}>
              {loading ? t.saving : t.saveBtn}
            </button>
            {msg && <div style={s[msg.type]}>{msg.text}</div>}
            <div style={s.disclaimer}>{t.disclaimer}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
