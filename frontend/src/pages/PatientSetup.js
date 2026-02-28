// src/pages/PatientSetup.js
import React, { useState } from 'react';
import { createPatient } from '../api';

const DISEASES = [
  { id: 'POTS', name: 'Postural Orthostatic Tachycardia Syndrome' },
  { id: 'EDS', name: 'Ehlers-Danlos Syndrome' },
  { id: 'ENS', name: 'Empty Nose Syndrome' },
  { id: 'Heterotaxy', name: 'Heterotaxy Syndrome' },
  { id: 'PCD', name: 'Primary Ciliary Dyskinesia' }
];

const s = {
  card: { background: '#1e293b', borderRadius: 12, padding: 32, border: '1px solid #334155', maxWidth: 520, margin: '0 auto', color: '#f8fafc' },
  title: { fontSize: 22, fontWeight: 700, color: '#f8fafc', marginBottom: 8 },
  sub: { fontSize: 14, color: '#cbd5e1', marginBottom: 28 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 6 },
  input: { width: '100%', padding: '10px 14px', border: '1px solid #475569', borderRadius: 8, fontSize: 15, boxSizing: 'border-box', marginBottom: 20, background: '#0f172a', color: '#f8fafc' },
  select: { width: '100%', padding: '10px 14px', border: '1px solid #475569', borderRadius: 8, fontSize: 15, boxSizing: 'border-box', marginBottom: 20, background: '#0f172a', color: '#f8fafc' },
  btn: { width: '100%', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 0', fontSize: 16, fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' },
  error: { color: '#fca5a5', fontSize: 13, marginBottom: 16, padding: '8px 12px', background: '#7f1d1d', borderRadius: 6 },
  success: { color: '#86efac', fontSize: 13, marginBottom: 16, padding: '8px 12px', background: '#14532d', borderRadius: 6 },
  diseaseCard: (active) => ({ border: `1.5px solid ${active ? '#3b82f6' : '#334155'}`, borderRadius: 10, padding: '12px 16px', marginBottom: 10, cursor: 'pointer', background: active ? '#1e3a8a' : '#0f172a', transition: 'all 0.15s' }),
  diseaseTitle: { fontWeight: 600, fontSize: 15, color: '#f8fafc' },
  diseaseSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 }
};

export default function PatientSetup({ onPatientCreated }) {
  const [patientId, setPatientId] = useState('');
  const [selectedDisease, setSelectedDisease] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleCreate = async () => {
    if (!patientId.trim()) { setError('Patient ID is required'); return; }
    if (!selectedDisease) { setError('Please select a disease'); return; }
    setError(''); setLoading(true);
    try {
      const res = await createPatient(patientId.trim(), selectedDisease);
      setSuccess(`Patient '${patientId}' created successfully!`);
      onPatientCreated(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create patient. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.card}>
      <div style={s.title}>Create Patient Profile</div>
      <div style={s.sub}>Set up a new patient to begin longitudinal symptom tracking and signal generation.</div>
      {error && <div style={s.error}>{error}</div>}
      {success && <div style={s.success}>{success}</div>}
      <label style={s.label}>Patient ID</label>
      <input
        style={s.input}
        placeholder="e.g. patient-001 or any identifier"
        value={patientId}
        onChange={e => setPatientId(e.target.value)}
      />
      <label style={s.label}>Select Disease</label>
      <div style={{ marginBottom: 20 }}>
        {DISEASES.map(d => (
          <div key={d.id} style={s.diseaseCard(selectedDisease === d.id)} onClick={() => setSelectedDisease(d.id)}>
            <div style={s.diseaseTitle}>{d.id}</div>
            <div style={s.diseaseSub}>{d.name}</div>
          </div>
        ))}
      </div>
      <button style={s.btn} onClick={handleCreate} disabled={loading}>
        {loading ? 'Creating...' : 'Create Patient Profile →'}
      </button>
    </div>
  );
}
