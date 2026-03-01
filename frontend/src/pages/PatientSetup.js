import React, { useState, useEffect } from 'react';
import { createPatient, listDiseases } from '../api';
import { useLang } from '../i18n/LanguageContext';
import theme from '../theme';

const s = {
  wrap: { display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '20px 0' },
  card: {
    background: theme.panelGradient, borderRadius: 16, padding: 36, border: `1px solid ${theme.border}`,
    width: '100%', maxWidth: 560, boxShadow: theme.shadowGlow, color: theme.text
  },
  heading: { fontSize: 24, fontWeight: 800, color: theme.text, marginBottom: 4, letterSpacing: '-0.5px' },
  sub: { fontSize: 14, color: theme.textMuted, marginBottom: 32, lineHeight: 1.6 },
  fieldGroup: { marginBottom: 20 },
  label: { display: 'block', fontSize: 12, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  input: {
    width: '100%', padding: '11px 14px', border: `1px solid ${theme.borderSoft}`, borderRadius: 10,
    fontSize: 14, boxSizing: 'border-box', background: theme.bg, color: theme.text,
    outline: 'none', transition: 'border 0.15s'
  },
  diseaseGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 320, overflowY: 'auto', paddingRight: 4 },
  diseaseCard: (active) => ({
    border: `1.5px solid ${active ? theme.teal : theme.border}`,
    borderRadius: 10, padding: '10px 14px', cursor: 'pointer',
    background: active ? `linear-gradient(180deg, ${theme.tealBg}, rgba(17, 24, 39, 0.92))` : theme.bg,
    transition: 'all 0.15s',
    boxShadow: active ? '0 8px 20px rgba(0, 0, 0, 0.18)' : 'none'
  }),
  diseaseId: { fontWeight: 700, fontSize: 14, color: theme.text },
  diseaseName: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  promptCard: {
    marginTop: 8,
    padding: '14px 16px',
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    background: theme.surfaceGradient,
    boxShadow: theme.shadowSoft
  },
  promptTitle: { fontSize: 12, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  promptText: { fontSize: 13, color: theme.text, lineHeight: 1.5, marginBottom: 10 },
  promptHelp: { fontSize: 12, color: theme.textMuted, lineHeight: 1.5, marginBottom: 12 },
  choiceRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  choiceBtn: (active) => ({
    padding: '9px 12px',
    borderRadius: 999,
    border: `1px solid ${active ? theme.teal : theme.borderSoft}`,
    background: active ? `linear-gradient(180deg, ${theme.tealBg}, rgba(31, 41, 55, 0.96))` : theme.surfaceGradient,
    color: active ? theme.tealSoft : theme.textSoft,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer'
  }),
  inlineField: { marginTop: 14 },
  btn: {
    width: '100%', background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDeep})`, color: '#fff',
    border: 'none', borderRadius: 10, padding: '13px 0', fontSize: 15, fontWeight: 700,
    cursor: 'pointer', marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
  },
  error: { color: theme.coral, fontSize: 13, padding: '10px 14px', background: theme.coralBg, border: `1px solid ${theme.coralDeep}`, borderRadius: 8, marginBottom: 16 },
  success: { color: theme.primary, fontSize: 13, padding: '10px 14px', background: theme.primaryBg, border: `1px solid ${theme.primary}`, borderRadius: 8, marginBottom: 16 },
};

export default function PatientSetup({ onPatientCreated }) {
  const { t } = useLang();
  const [patientId, setPatientId] = useState('');
  const [selectedDisease, setSelectedDisease] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [diseases, setDiseases] = useState([]);
  const [wearableUsage, setWearableUsage] = useState('');
  const [deviceType, setDeviceType] = useState('');
  const [wantsLink, setWantsLink] = useState('');

  useEffect(() => {
    listDiseases().then(res => setDiseases(res.data)).catch(console.error);
  }, []);

  const handleCreate = async () => {
    if (!patientId.trim()) { setError(t.errorNoId); return; }
    if (!selectedDisease) { setError(t.errorNoDisease); return; }
    setError(''); setLoading(true);
    try {
      const usesWearable =
        wearableUsage === 'yes' ? true : wearableUsage === 'no' ? false : null;
      const res = await createPatient(
        patientId.trim(),
        selectedDisease,
        usesWearable,
        usesWearable ? (deviceType.trim() || null) : null,
        usesWearable ? (wantsLink === 'yes' ? true : wantsLink === 'no' ? false : null) : null
      );
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
              <div
                key={d.id}
                style={s.diseaseCard(selectedDisease === d.id)}
                onClick={() => {
                  setSelectedDisease(d.id);
                  setWearableUsage('');
                  setDeviceType('');
                  setWantsLink('');
                }}
              >
                <div style={s.diseaseId}>{selectedDisease === d.id ? '✓ ' : ''}{d.id}</div>
                <div style={s.diseaseName}>{d.name}</div>
              </div>
            ))}
          </div>
        </div>

        {selectedDisease && (
          <div style={s.fieldGroup}>
            <div style={s.promptCard}>
              <div style={s.promptTitle}>{t.wearablePromptLabel}</div>
              <div style={s.promptText}>{t.wearablePromptQuestion}</div>
              <div style={s.promptHelp}>{t.wearablePromptHelp}</div>
              <div style={s.choiceRow}>
                <button
                  type="button"
                  style={s.choiceBtn(wearableUsage === 'yes')}
                  onClick={() => setWearableUsage('yes')}
                >
                  {wearableUsage === 'yes' ? '✓ ' : ''}{t.wearableYes}
                </button>
                <button
                  type="button"
                  style={s.choiceBtn(wearableUsage === 'no')}
                  onClick={() => {
                    setWearableUsage('no');
                    setDeviceType('');
                    setWantsLink('');
                  }}
                >
                  {wearableUsage === 'no' ? '✓ ' : ''}{t.wearableNo}
                </button>
              </div>

              {wearableUsage === 'yes' && (
                <>
                  <div style={s.inlineField}>
                    <label style={s.label}>{t.deviceTypeLabel}</label>
                    <input
                      style={s.input}
                      placeholder={t.deviceTypePlaceholder}
                      value={deviceType}
                      onChange={e => setDeviceType(e.target.value)}
                    />
                  </div>

                  <div style={s.inlineField}>
                    <div style={s.promptTitle}>{t.linkPromptLabel}</div>
                    <div style={s.promptText}>{t.linkPromptQuestion}</div>
                    <div style={s.choiceRow}>
                      <button
                        type="button"
                        style={s.choiceBtn(wantsLink === 'yes')}
                        onClick={() => setWantsLink('yes')}
                      >
                        {wantsLink === 'yes' ? '✓ ' : ''}{t.linkYes}
                      </button>
                      <button
                        type="button"
                        style={s.choiceBtn(wantsLink === 'no')}
                        onClick={() => setWantsLink('no')}
                      >
                        {wantsLink === 'no' ? '✓ ' : ''}{t.linkNo}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <button style={s.btn} onClick={handleCreate} disabled={loading}>
          {loading ? t.creating : t.createBtn}
        </button>
      </div>
    </div>
  );
}
