// src/App.js — RareSignal AI React App
import React, { useState, useEffect } from 'react';
import PatientDashboard from './pages/PatientDashboard';
import SignalVisualization from './pages/SignalVisualization';
import ClinicianView from './pages/ClinicianView';
import PatientSetup from './pages/PatientSetup';
import { listPatients } from './api';

const STYLES = {
  app: { fontFamily: 'system-ui, -apple-system, sans-serif', minHeight: '100vh', background: '#0f172a', color: '#f8fafc' },
  nav: { background: '#1e293b', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 0, boxShadow: '0 2px 12px rgba(0,0,0,0.4)', borderBottom: '1px solid #334155' },
  logo: { color: '#f8fafc', fontWeight: 700, fontSize: 20, padding: '16px 24px 16px 0', letterSpacing: '-0.5px' },
  logoSub: { color: '#60a5fa', fontSize: 12, fontWeight: 400 },
  navBtn: (active) => ({
    background: active ? '#0f172a' : 'transparent',
    border: 'none', color: active ? '#f8fafc' : '#94a3b8',
    padding: '16px 20px', cursor: 'pointer', fontSize: 14,
    fontWeight: active ? 600 : 400, borderBottom: active ? '3px solid #3b82f6' : '3px solid transparent',
    transition: 'all 0.15s'
  }),
  content: { maxWidth: 1100, margin: '0 auto', padding: '24px 16px' },
  patientBar: { background: '#1e293b', borderRadius: 10, padding: '12px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, border: '1px solid #334155' },
  patientSelect: { padding: '8px 12px', border: '1px solid #475569', borderRadius: 8, fontSize: 14, background: '#0f172a', color: '#f8fafc', minWidth: 220 },
  badge: (disease) => ({
    display: 'inline-block', padding: '3px 10px', borderRadius: 20,
    fontSize: 12, fontWeight: 600,
    background: { POTS: '#1e3a8a', EDS: '#14532d', ENS: '#78350f', Heterotaxy: '#7f1d1d', PCD: '#581c87', FMF: '#831843' }[disease] || '#1e3a8a',
    color: { POTS: '#bfdbfe', EDS: '#bbf7d0', ENS: '#fde68a', Heterotaxy: '#fecaca', PCD: '#e9d5ff', FMF: '#fbcfe8' }[disease] || '#bfdbfe'
  }),
  noPatient: { textAlign: 'center', padding: 60, color: '#94a3b8' }
};

export default function App() {
  const [page, setPage] = useState('setup');
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const loadPatients = async () => {
    try {
      const res = await listPatients();
      setPatients(res.data);
      if (res.data.length > 0 && !selectedPatient) {
        setSelectedPatient(res.data[0]);
      }
    } catch (e) {
      // Backend may not be running yet
    }
  };

  useEffect(() => { loadPatients(); }, []);

  const onPatientCreated = (patient) => {
    setPatients(prev => [...prev, patient]);
    setSelectedPatient(patient);
    setPage('input');
  };

  return (
    <div style={STYLES.app}>
      <nav style={STYLES.nav}>
        <div style={STYLES.logo}>
          RareSignal AI
          <div style={STYLES.logoSub}>Symptom-to-Signal Translation</div>
        </div>
        {['setup', 'input', 'signals', 'clinician'].map(p => (
          <button key={p} style={STYLES.navBtn(page === p)} onClick={() => setPage(p)}>
            {{ setup: '⚙ Setup', input: '📝 Daily Input', signals: '📊 Signals', clinician: '🩺 Clinician View' }[p]}
          </button>
        ))}
      </nav>

      <div style={STYLES.content}>
        {page !== 'setup' && (
          <div style={STYLES.patientBar}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>Active Patient:</label>
            <select
              style={STYLES.patientSelect}
              value={selectedPatient?.id || ''}
              onChange={e => {
                const p = patients.find(pt => pt.id === e.target.value);
                setSelectedPatient(p || null);
              }}
            >
              {patients.length === 0 && <option value="">No patients — go to Setup</option>}
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.id} ({p.disease})</option>
              ))}
            </select>
            {selectedPatient && (
              <span style={STYLES.badge(selectedPatient.disease)}>{selectedPatient.disease}</span>
            )}
          </div>
        )}

        {page === 'setup' && <PatientSetup onPatientCreated={onPatientCreated} />}
        {page === 'input' && (
          selectedPatient
            ? <PatientDashboard patient={selectedPatient} />
            : <div style={STYLES.noPatient}><p>No patient selected. Go to Setup first.</p></div>
        )}
        {page === 'signals' && (
          selectedPatient
            ? <SignalVisualization patient={selectedPatient} />
            : <div style={STYLES.noPatient}><p>No patient selected. Go to Setup first.</p></div>
        )}
        {page === 'clinician' && (
          selectedPatient
            ? <ClinicianView patient={selectedPatient} />
            : <div style={STYLES.noPatient}><p>No patient selected. Go to Setup first.</p></div>
        )}
      </div>
    </div>
  );
}
