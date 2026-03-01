import React, { useState, useEffect } from 'react';
import { createPatient, listDiseases } from '../api';
import { useLang } from '../i18n/LanguageContext';

const s = {
  wrap: { display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '20px 0' },
  card: {
    background: '#161b22', borderRadius: 16, padding: 36, border: '1px solid #21262d',
    width: '100%', maxWidth: 560, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', color: '#e6edf3'
  },
  heading: { fontSize: 24, fontWeight: 800, color: '#e6edf3', marginBottom: 4, letterSpacing: '-0.5px' },
  sub: { fontSize: 14, color: '#484f58', marginBottom: 32, lineHeight: 1.6 },
  fieldGroup: { marginBottom: 20 },
  label: { display: 'block', fontSize: 12, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  input: {
    width: '100%', padding: '11px 14px', border: '1px solid #30363d', borderRadius: 10,
    fontSize: 14, boxSizing: 'border-box', background: '#0d1117', color: '#e6edf3',
    outline: 'none', transition: 'border 0.15s'
  },
  diseaseGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 320, overflowY: 'auto', paddingRight: 4 },
  diseaseCard: (active) => ({
    border: `1.5px solid ${active ? '#3fb950' : '#21262d'}`,
    borderRadius: 10, padding: '10px 14px', cursor: 'pointer',
    background: active ? 'rgba(63, 185, 80, 0.08)' : '#0d1117',
    transition: 'all 0.15s'
  }),
  diseaseId: { fontWeight: 700, fontSize: 14, color: '#e6edf3' },
  diseaseName: { fontSize: 11, color: '#8b949e', marginTop: 2 },
  btn: {
    width: '100%', background: 'linear-gradient(135deg, #3fb950, #1a7f37)', color: '#fff',
    border: 'none', borderRadius: 10, padding: '13px 0', fontSize: 15, fontWeight: 700,
    cursor: 'pointer', marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
  },
  error: { color: '#f85149', fontSize: 13, padding: '10px 14px', background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: 8, marginBottom: 16 },
  success: { color: '#3fb950', fontSize: 13, padding: '10px 14px', background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.3)', borderRadius: 8, marginBottom: 16 },
};

export default function PatientSetup({ onPatientCreated }) {
  const { t } = useLang();
  const [patientId, setPatientId] = useState('');
  const [selectedDisease, setSelectedDisease] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [diseases, setDiseases] = useState([]);

  useEffect(() => {
    listDiseases().then(res => setDiseases(res.data)).catch(console.error);
  }, []);

  const handleCreate = async () => {
    if (!patientId.trim()) { setError(t.errorNoId); return; }
    if (!selectedDisease) { setError(t.errorNoDisease); return; }
    setError(''); setLoading(true);
    try {
      const res = await createPatient(patientId.trim(), selectedDisease);
      setSuccess(t.successPatient(patientId));
      onPatientCreated(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || t.errorCreate);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.heading}>{t.setupTitle}</div>
        <div style={s.sub}>{t.setupSub}</div>

        {error && <div style={s.error}>⚠ {error}</div>}
        {success && <div style={s.success}>✓ {success}</div>}

        <div style={s.fieldGroup}>
          <label style={s.label}>{t.patientIdLabel}</label>
          <input
            style={s.input}
            placeholder={t.patientIdPlaceholder}
            value={patientId}
            onChange={e => setPatientId(e.target.value)}
          />
        </div>

        <div style={s.fieldGroup}>
          <label style={s.label}>{t.diseaseLabel} ({diseases.length} {t.diseaseAvailable})</label>
          <div style={s.diseaseGrid}>
            {diseases.map(d => (
              <div key={d.id} style={s.diseaseCard(selectedDisease === d.id)} onClick={() => setSelectedDisease(d.id)}>
                <div style={s.diseaseId}>{selectedDisease === d.id ? '✓ ' : ''}{d.id}</div>
                <div style={s.diseaseName}>{d.name}</div>
              </div>
            ))}
          </div>
        </div>

        <button style={s.btn} onClick={handleCreate} disabled={loading}>
          {loading ? t.creating : t.createBtn}
        </button>
      </div>
    </div>
  );
}
