// src/pages/PatientDashboard.js — Daily symptom entry (Premium UI)
import React, { useState, useEffect } from 'react';
import { addEntry, getDiseaseConfig, computeSignals } from '../api';
import { useLang } from '../i18n/LanguageContext';
import theme from '../theme';

const severityColor = (v) => v >= 7 ? theme.coral : v >= 4 ? theme.amber : theme.primary;
const defaultLifestyleContext = () => ({
  sleep_duration_hours: 8,
  sleep_disruption: 'no',
  activity_level: 'moderate',
  overexertion: 'no',
  activity_worsened_symptoms: 'unsure',
  mentally_demanding_day: 'no',
  emotional_strain_note: '',
  hydration_level: 'adequate',
  large_or_unusual_meals: 'no',
  missed_meals: 'no',
  heat_exposure: 'no',
  cold_exposure: 'no',
  illness_symptoms: 'no',
  travel_or_routine_change: 'no',
});

const defaultSharedExperience = () => ({
  helpful_today: [],
  made_harder_today: [],
  wish_known_earlier: '',
});

const s = {
  pageTitle: { fontSize: 24, fontWeight: 800, color: theme.text, letterSpacing: '-0.5px', marginBottom: 4 },
  pageSub: { fontSize: 14, color: theme.textMuted, marginBottom: 28 },
  grid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.65fr) minmax(320px, 1fr)', gap: 20, alignItems: 'start' },
  bottomGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.65fr) minmax(320px, 1fr)', gap: 20, marginTop: 20, alignItems: 'start' },
  card: {
    background: theme.panelGradient, borderRadius: 14, padding: 24,
    border: `1px solid ${theme.border}`, boxShadow: theme.shadowGlow
  },
  cardTitle: { fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 18 },
  sliderRow: { marginBottom: 20 },
  sliderTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sliderName: { fontSize: 13, fontWeight: 600, color: theme.textSoft },
  sliderVal: (v) => ({
    fontSize: 13, fontWeight: 800, color: severityColor(v),
    background: `${severityColor(v)}1a`, padding: '2px 10px', borderRadius: 20
  }),
  contextValue: {
    fontSize: 12, fontWeight: 700, color: theme.tealSoft,
    background: theme.tealBg, padding: '3px 10px', borderRadius: 20
  },
  sliderTrack: { width: '100%', accentColor: theme.primary, height: 4, cursor: 'pointer' },
  helperText: { fontSize: 12, color: theme.textMuted, lineHeight: 1.5, marginBottom: 14 },
  sectionBlock: { marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${theme.border}` },
  sectionHeading: { fontSize: 11, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 700, marginBottom: 10 },
  microLabel: { display: 'block', fontSize: 12, color: theme.textSoft, fontWeight: 600, marginBottom: 8 },
  choiceRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  choiceBtn: (active) => ({
    padding: '8px 11px',
    borderRadius: 999,
    border: `1px solid ${active ? theme.teal : theme.borderSoft}`,
    background: active ? `linear-gradient(180deg, ${theme.tealBg}, rgba(17, 24, 39, 0.92))` : theme.surfaceGradient,
    color: active ? theme.tealSoft : theme.textMuted,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer'
  }),
  contextToggle: {
    width: '100%', marginTop: 4, background: 'transparent', border: `1px dashed ${theme.borderSoft}`, borderRadius: 10,
    padding: '10px 12px', color: theme.textMuted, fontSize: 12, fontWeight: 700, cursor: 'pointer'
  },
  shareTagGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 12 },
  shareTag: (active) => ({
    padding: '8px 10px',
    borderRadius: 10,
    border: `1px solid ${active ? theme.teal : theme.border}`,
    background: active ? `linear-gradient(180deg, ${theme.tealBg}, rgba(17, 24, 39, 0.92))` : theme.surfaceGradient,
    color: active ? theme.tealSoft : theme.textMuted,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
  }),
  triggerGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 },
  triggerBtn: (active) => ({
    padding: '8px 10px', border: `1px solid ${active ? theme.teal : theme.border}`,
    borderRadius: 8, background: active ? `linear-gradient(180deg, ${theme.tealBg}, rgba(17, 24, 39, 0.92))` : theme.surfaceGradient,
    fontSize: 12, fontWeight: active ? 700 : 400, cursor: 'pointer',
    color: active ? theme.tealSoft : theme.textMuted, textAlign: 'left', transition: 'all 0.12s'
  }),
  textarea: {
    width: '100%', border: `1px solid ${theme.borderSoft}`, borderRadius: 10, padding: '10px 14px',
    fontSize: 13, resize: 'vertical', minHeight: 80, boxSizing: 'border-box',
    background: theme.surfaceGradient, color: theme.text, outline: 'none'
  },
  submitBtn: {
    marginTop: 16, width: '100%', background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDeep})`,
    color: '#fff', border: 'none', borderRadius: 10, padding: '13px 0',
    fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
  },
  success: { background: theme.primaryBg, color: theme.primary, border: `1px solid ${theme.primary}`, borderRadius: 8, padding: '10px 14px', marginTop: 12, fontSize: 13 },
  error: { background: theme.coralBg, color: theme.coral, border: `1px solid ${theme.coralDeep}`, borderRadius: 8, padding: '10px 14px', marginTop: 12, fontSize: 13 },
  disclaimer: { fontSize: 11, color: theme.textMeta, marginTop: 16, fontStyle: 'italic', lineHeight: 1.5, textAlign: 'center' },
  loading: { padding: 40, color: theme.textMuted, textAlign: 'center' }
};

export default function PatientDashboard({ patient }) {
  const { t } = useLang();
  const [config, setConfig] = useState(null);
  const [symptoms, setSymptoms] = useState({});
  const [triggers, setTriggers] = useState([]);
  const [notes, setNotes] = useState('');
  const [lifestyleContext, setLifestyleContext] = useState(defaultLifestyleContext);
  const [sharedExperience, setSharedExperience] = useState(defaultSharedExperience);
  const [showMoreContext, setShowMoreContext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    getDiseaseConfig(patient.disease).then(res => {
      setConfig(res.data);
      const initial = {};
      res.data.symptoms.forEach(s => { initial[s] = 5.0; });
      setSymptoms(initial);
      setLifestyleContext(defaultLifestyleContext());
      setSharedExperience(defaultSharedExperience());
    }).catch(() => { });
  }, [patient.disease]);

  const toggleTrigger = (t) => {
    setTriggers(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const updateLifestyle = (key, value) => {
    setLifestyleContext(prev => ({ ...prev, [key]: value }));
  };

  const toggleSharedListItem = (key, value) => {
    setSharedExperience((prev) => {
      const current = prev[key] || [];
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      return { ...prev, [key]: next };
    });
  };

  const renderChoiceGroup = (value, onChange, options) => (
    <div style={s.choiceRow}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          style={s.choiceBtn(value === option.value)}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  const handleSubmit = async () => {
    setLoading(true); setMsg(null);
    try {
      await addEntry({
        patient_id: patient.id,
        symptoms,
        triggers,
        lifestyle_context: lifestyleContext,
        shared_experience: sharedExperience,
        notes: notes || null
      });
      await computeSignals(patient.id, 7);
      setMsg({ type: 'success', text: t.saveDone });
      setNotes('');
      setSharedExperience(defaultSharedExperience());
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || t.saveError });
    } finally {
      setLoading(false);
    }
  };

  if (!config) return <div style={s.loading}>{t.loadingConfig}</div>;

  const yesNoOptions = [
    { value: 'yes', label: t.choiceYes },
    { value: 'no', label: t.choiceNo },
  ];
  const yesNoUnsureOptions = [
    { value: 'yes', label: t.choiceYes },
    { value: 'no', label: t.choiceNo },
    { value: 'unsure', label: t.choiceUnsure },
  ];
  const activityOptions = [
    { value: 'low', label: t.choiceLow },
    { value: 'moderate', label: t.choiceModerate },
    { value: 'high', label: t.choiceHigh },
  ];
  const hydrationOptions = [
    { value: 'low', label: t.choiceLow },
    { value: 'adequate', label: t.choiceAdequate },
    { value: 'high', label: t.choiceHigh },
  ];
  const helpfulOptions = [
    t.shareOptionHydration,
    t.shareOptionPacing,
    t.shareOptionRestBreaks,
    t.shareOptionQuietTime,
    t.shareOptionRegularMeals,
    t.shareOptionSleepProtection,
  ];
  const harderOptions = [
    t.shareOptionOverexertion,
    t.shareOptionPoorSleep,
    t.shareOptionHeat,
    t.shareOptionStressLoad,
    t.shareOptionRoutineChange,
    t.shareOptionLargeMeals,
  ];

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

        {/* Context column */}
        <div style={s.card}>
          <div style={s.cardTitle}>{t.contextTitle}</div>
          <div style={s.helperText}>{t.contextSub}</div>

          <div style={s.sectionBlock}>
            <div style={s.sectionHeading}>{t.sleepDomain}</div>
            <label style={s.microLabel}>{t.sleepDurationLabel}</label>
            <div style={{ ...s.sliderTop, marginBottom: 10 }}>
              <span style={s.sliderName}>{t.sleepDurationLabel}</span>
              <span style={s.contextValue}>
                {t.sleepDurationHours(lifestyleContext.sleep_duration_hours)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={12}
              step={0.5}
              style={s.sliderTrack}
              value={lifestyleContext.sleep_duration_hours}
              onChange={(e) => updateLifestyle('sleep_duration_hours', parseFloat(e.target.value))}
            />
            <label style={{ ...s.microLabel, marginTop: 12 }}>{t.sleepDisruptionLabel}</label>
            {renderChoiceGroup(lifestyleContext.sleep_disruption, (value) => updateLifestyle('sleep_disruption', value), yesNoOptions)}
          </div>

          <div style={s.sectionBlock}>
            <div style={s.sectionHeading}>{t.activityDomain}</div>
            <label style={s.microLabel}>{t.activityLevelLabel}</label>
            {renderChoiceGroup(lifestyleContext.activity_level, (value) => updateLifestyle('activity_level', value), activityOptions)}
          </div>

          <div style={s.sectionBlock}>
            <div style={s.sectionHeading}>{t.stressDomain}</div>
            <label style={s.microLabel}>{t.mentallyDemandingLabel}</label>
            {renderChoiceGroup(lifestyleContext.mentally_demanding_day, (value) => updateLifestyle('mentally_demanding_day', value), yesNoOptions)}
          </div>

          <div style={{ ...s.sectionBlock, borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
            <div style={s.sectionHeading}>{t.hydrationDomain}</div>
            <label style={s.microLabel}>{t.hydrationLabel}</label>
            {renderChoiceGroup(lifestyleContext.hydration_level, (value) => updateLifestyle('hydration_level', value), hydrationOptions)}
          </div>

          <button type="button" style={s.contextToggle} onClick={() => setShowMoreContext(prev => !prev)}>
            {showMoreContext ? t.contextLess : t.contextMore}
          </button>

          {showMoreContext && (
            <div style={{ marginTop: 16 }}>
              <div style={s.sectionBlock}>
                <div style={s.sectionHeading}>{t.activityDomain}</div>
                <label style={s.microLabel}>{t.overexertionLabel}</label>
                {renderChoiceGroup(lifestyleContext.overexertion, (value) => updateLifestyle('overexertion', value), yesNoOptions)}
                <label style={s.microLabel}>{t.activityWorsenedLabel}</label>
                {renderChoiceGroup(lifestyleContext.activity_worsened_symptoms, (value) => updateLifestyle('activity_worsened_symptoms', value), yesNoUnsureOptions)}
              </div>

              <div style={s.sectionBlock}>
                <div style={s.sectionHeading}>{t.stressDomain}</div>
                <label style={s.microLabel}>{t.emotionalStrainLabel}</label>
                <textarea
                  style={{ ...s.textarea, minHeight: 70 }}
                  placeholder={t.emotionalStrainPlaceholder}
                  value={lifestyleContext.emotional_strain_note}
                  onChange={(e) => updateLifestyle('emotional_strain_note', e.target.value)}
                />
              </div>

              <div style={s.sectionBlock}>
                <div style={s.sectionHeading}>{t.hydrationDomain}</div>
                <label style={s.microLabel}>{t.unusualMealsLabel}</label>
                {renderChoiceGroup(lifestyleContext.large_or_unusual_meals, (value) => updateLifestyle('large_or_unusual_meals', value), yesNoOptions)}
                <label style={s.microLabel}>{t.missedMealsLabel}</label>
                {renderChoiceGroup(lifestyleContext.missed_meals, (value) => updateLifestyle('missed_meals', value), yesNoOptions)}
              </div>

              <div style={{ ...s.sectionBlock, borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
                <div style={s.sectionHeading}>{t.environmentDomain}</div>
                <label style={s.microLabel}>{t.heatExposureLabel}</label>
                {renderChoiceGroup(lifestyleContext.heat_exposure, (value) => updateLifestyle('heat_exposure', value), yesNoOptions)}
                <label style={s.microLabel}>{t.coldExposureLabel}</label>
                {renderChoiceGroup(lifestyleContext.cold_exposure, (value) => updateLifestyle('cold_exposure', value), yesNoOptions)}
                <label style={s.microLabel}>{t.illnessSymptomsLabel}</label>
                {renderChoiceGroup(lifestyleContext.illness_symptoms, (value) => updateLifestyle('illness_symptoms', value), yesNoOptions)}
                <label style={s.microLabel}>{t.travelChangeLabel}</label>
                {renderChoiceGroup(lifestyleContext.travel_or_routine_change, (value) => updateLifestyle('travel_or_routine_change', value), yesNoOptions)}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={s.bottomGrid}>
        <div style={s.card}>
          <div style={s.cardTitle}>{t.triggersTitle}</div>
          <div style={s.triggerGrid}>
            {config.triggers.map(t_item => (
              <button key={t_item} style={s.triggerBtn(triggers.includes(t_item))} onClick={() => toggleTrigger(t_item)}>
                {triggers.includes(t_item) ? '✓ ' : ''}{t.triggers[t_item] || t_item.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          <div style={{ ...s.sectionBlock, marginTop: 18, borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
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
        <div style={s.card}>
          <div style={s.cardTitle}>{t.shareTitle}</div>
          <div style={s.helperText}>{t.shareSub}</div>
          <label style={s.microLabel}>{t.shareHelpfulLabel}</label>
          <div style={s.shareTagGrid}>
            {helpfulOptions.map((option) => (
              <button
                key={option}
                type="button"
                style={s.shareTag(sharedExperience.helpful_today.includes(option))}
                onClick={() => toggleSharedListItem('helpful_today', option)}
              >
                {sharedExperience.helpful_today.includes(option) ? '✓ ' : ''}{option}
              </button>
            ))}
          </div>
          <label style={s.microLabel}>{t.shareHarderLabel}</label>
          <div style={s.shareTagGrid}>
            {harderOptions.map((option) => (
              <button
                key={option}
                type="button"
                style={s.shareTag(sharedExperience.made_harder_today.includes(option))}
                onClick={() => toggleSharedListItem('made_harder_today', option)}
              >
                {sharedExperience.made_harder_today.includes(option) ? '✓ ' : ''}{option}
              </button>
            ))}
          </div>
          <label style={s.microLabel}>{t.shareWishLabel}</label>
          <textarea
            style={{ ...s.textarea, minHeight: 66 }}
            maxLength={160}
            placeholder={t.shareWishPlaceholder}
            value={sharedExperience.wish_known_earlier}
            onChange={(e) => setSharedExperience((prev) => ({ ...prev, wish_known_earlier: e.target.value }))}
          />
        </div>
      </div>
    </div>
  );
}
