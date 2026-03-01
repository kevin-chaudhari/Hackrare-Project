import React, { useEffect, useState } from 'react';
import { getEntries, getDiseaseConfig, getSharedExperiencesSummary } from '../api';
import { useLang } from '../i18n/LanguageContext';
import theme from '../theme';

const GROUPS = {
  autonomic: new Set(['POTS', 'EDS', 'ENS', 'FXS', 'HD', 'PKU', 'NF1', 'PRION']),
  respiratory: new Set(['PCD', 'CF', 'Heterotaxy', 'RRP', 'SMA', 'Pompe', 'TS', 'RTT']),
  inflammatory: new Set(['FMF', 'Gaucher', 'WD', 'Alkaptonuria']),
  cardiovascular: new Set(['MFS', 'Heterotaxy', 'POTS']),
};

const FOCUS_LABEL_KEYS = {
  fatigue: 'sharedFocusFatigue',
  pain: 'sharedFocusPain',
  gi: 'sharedFocusGi',
  stress: 'sharedFocusStress',
};

const s = {
  pageTitle: { fontSize: 24, fontWeight: 800, color: theme.text, letterSpacing: '-0.5px', marginBottom: 4 },
  pageSub: { fontSize: 14, color: theme.textMuted, marginBottom: 24, lineHeight: 1.7 },
  hero: {
    background: theme.panelGradient,
    border: `1px solid ${theme.border}`,
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    boxShadow: theme.shadowGlow,
  },
  heroEyebrow: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.4, color: theme.teal, marginBottom: 10 },
  heroTitle: { fontSize: 20, fontWeight: 800, color: theme.text, marginBottom: 8 },
  heroText: { fontSize: 13, color: theme.textSoft, lineHeight: 1.7 },
  filterRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 },
  chip: (active) => ({
    padding: '8px 12px',
    borderRadius: 999,
    border: `1px solid ${active ? theme.teal : theme.borderSoft}`,
    background: active ? theme.tealBg : theme.surfaceGradient,
    color: active ? theme.tealSoft : theme.textMuted,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  }),
  grid: { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginBottom: 20 },
  card: {
    background: theme.panelGradient,
    border: `1px solid ${theme.border}`,
    borderRadius: 16,
    padding: 22,
    boxShadow: theme.shadowGlow,
  },
  cardTitle: { fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 10 },
  cardSub: { fontSize: 12, color: theme.textMuted, lineHeight: 1.6, marginBottom: 14 },
  insightItem: { padding: '12px 14px', borderRadius: 12, background: theme.surfaceGradient, border: `1px solid ${theme.border}`, marginBottom: 10 },
  insightText: { fontSize: 13, color: theme.textSoft, lineHeight: 1.7 },
  splitGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  splitBox: (tone) => ({
    borderRadius: 14,
    padding: 16,
    background: tone === 'helpful' ? theme.tealBg : theme.amberBg,
    border: `1px solid ${tone === 'helpful' ? theme.teal : theme.amberDeep}`,
  }),
  splitTitle: (tone) => ({ fontSize: 12, fontWeight: 700, color: tone === 'helpful' ? theme.tealSoft : theme.amber, marginBottom: 10 }),
  bullet: { fontSize: 13, color: theme.textSoft, lineHeight: 1.7, marginBottom: 8 },
  caution: {
    marginTop: 14,
    padding: '10px 14px',
    borderRadius: 12,
    background: theme.surfaceGradient,
    border: `1px dashed ${theme.borderSoft}`,
    color: theme.textMuted,
    fontSize: 12,
    lineHeight: 1.7,
  },
  listItem: { padding: '9px 0', borderBottom: `1px solid ${theme.border}`, fontSize: 13, color: theme.textSoft, lineHeight: 1.7 },
  empty: { padding: 28, textAlign: 'center', color: theme.textMuted, background: theme.surfaceGradient, borderRadius: 14, border: `1px solid ${theme.border}` },
};

function getDiseaseGroup(disease) {
  if (GROUPS.autonomic.has(disease)) return 'autonomic';
  if (GROUPS.respiratory.has(disease)) return 'respiratory';
  if (GROUPS.inflammatory.has(disease)) return 'inflammatory';
  if (GROUPS.cardiovascular.has(disease)) return 'cardiovascular';
  return 'general';
}

export default function SharedExperiences({ patient }) {
  const { t } = useLang();
  const [entries, setEntries] = useState([]);
  const [config, setConfig] = useState(null);
  const [sharedSummary, setSharedSummary] = useState(null);
  const [similarOnly, setSimilarOnly] = useState(true);
  const [hideDietary, setHideDietary] = useState(false);
  const [focus, setFocus] = useState('all');

  useEffect(() => {
    let active = true;
    Promise.all([getEntries(patient.id, 7), getDiseaseConfig(patient.disease), getSharedExperiencesSummary(patient.disease)])
      .then(([entriesRes, configRes, sharedRes]) => {
        if (!active) return;
        setEntries(entriesRes.data || []);
        setConfig(configRes.data || null);
        setSharedSummary(sharedRes.data || null);
      })
      .catch(() => {
        if (!active) return;
        setEntries([]);
        setSharedSummary(null);
      });
    return () => { active = false; };
  }, [patient.id, patient.disease]);

  const latestEntry = entries[0] || null;
  const latestSymptoms = latestEntry?.symptoms || {};
  const lifestyle = latestEntry?.lifestyle_context || {};
  const symptomLabels = config?.symptom_labels || {};
  const topSymptoms = Object.entries(latestSymptoms)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => symptomLabels[key] || key.replace(/_/g, ' '));
  const diseaseGroup = getDiseaseGroup(patient.disease);

  const contextTags = [];
  if (lifestyle.sleep_disruption === 'yes' || (typeof lifestyle.sleep_duration_hours === 'number' && lifestyle.sleep_duration_hours < 6)) {
    contextTags.push(t.sharedTagPoorSleep);
  }
  if (lifestyle.mentally_demanding_day === 'yes' || latestSymptoms.stress_symptom_severity >= 6) {
    contextTags.push(t.sharedTagStress);
  }
  if (lifestyle.heat_exposure === 'yes') contextTags.push(t.sharedTagHeat);
  if (lifestyle.cold_exposure === 'yes') contextTags.push(t.sharedTagCold);
  if (lifestyle.illness_symptoms === 'yes') contextTags.push(t.sharedTagIllness);
  if (lifestyle.activity_worsened_symptoms === 'yes' || lifestyle.overexertion === 'yes') {
    contextTags.push(t.sharedTagExertion);
  }

  const baseInsights = {
    autonomic: [
      t.sharedInsightAutonomic1,
      t.sharedInsightAutonomic2,
      t.sharedInsightAutonomic3,
    ],
    respiratory: [
      t.sharedInsightRespiratory1,
      t.sharedInsightRespiratory2,
      t.sharedInsightRespiratory3,
    ],
    inflammatory: [
      t.sharedInsightInflammatory1,
      t.sharedInsightInflammatory2,
      t.sharedInsightInflammatory3,
    ],
    cardiovascular: [
      t.sharedInsightCardio1,
      t.sharedInsightCardio2,
      t.sharedInsightCardio3,
    ],
    general: [
      t.sharedInsightGeneral1,
      t.sharedInsightGeneral2,
      t.sharedInsightGeneral3,
    ],
  };

  const contextualInsight = contextTags.length
    ? t.sharedContextualInsight(contextTags.join(', '))
    : t.sharedContextualFallback;

  const passiveInsights = [
    ...(baseInsights[diseaseGroup] || baseInsights.general),
    topSymptoms.length ? t.sharedTopSymptomsInsight(topSymptoms.join(', ')) : null,
    similarOnly ? t.sharedSimilarPatternInsight : t.sharedWiderPatternInsight,
    contextualInsight,
  ].filter(Boolean);

  let helpful = [
    t.sharedHelpfulHydration,
    t.sharedHelpfulPacing,
    t.sharedHelpfulRest,
    t.sharedHelpfulPlanning,
  ];
  let unhelpful = [
    t.sharedUnhelpfulPushing,
    t.sharedUnhelpfulPoorSleep,
    t.sharedUnhelpfulHeat,
    t.sharedUnhelpfulRoutineChange,
  ];

  if (focus === 'fatigue') {
    helpful = [t.sharedHelpfulRest, t.sharedHelpfulPacing, t.sharedHelpfulPlanning];
    unhelpful = [t.sharedUnhelpfulPushing, t.sharedUnhelpfulPoorSleep];
  } else if (focus === 'pain') {
    helpful = [t.sharedHelpfulPacing, t.sharedHelpfulRest];
    unhelpful = [t.sharedUnhelpfulPushing, t.sharedUnhelpfulRoutineChange];
  } else if (focus === 'gi') {
    helpful = [t.sharedHelpfulRegularMeals, t.sharedHelpfulHydration];
    unhelpful = [t.sharedUnhelpfulLargeMeals, t.sharedUnhelpfulSkippedMeals];
  } else if (focus === 'stress') {
    helpful = [t.sharedHelpfulQuietTime, t.sharedHelpfulPlanning];
    unhelpful = [t.sharedUnhelpfulOverload, t.sharedUnhelpfulPoorSleep];
  }

  if (hideDietary) {
    helpful = helpful.filter((item) => !item.includes(t.sharedDietaryMarker));
    unhelpful = unhelpful.filter((item) => !item.includes(t.sharedDietaryMarker));
  }

  const helpfulCounts = Object.entries(sharedSummary?.helpful_counts || {});
  const harderCounts = Object.entries(sharedSummary?.harder_counts || {});
  const wisdomSnippets = sharedSummary?.wisdom_snippets || [];

  const helpfulDisplay = helpfulCounts.length
    ? helpfulCounts
        .map(([label, count]) => `${label} (${count})`)
        .filter((item) => !hideDietary || !item.includes(t.sharedDietaryMarker))
    : helpful;
  const harderDisplay = harderCounts.length
    ? harderCounts
        .map(([label, count]) => `${label} (${count})`)
        .filter((item) => !hideDietary || !item.includes(t.sharedDietaryMarker))
    : unhelpful;

  const prompts = [
    t.sharedPrompt1,
    t.sharedPrompt2,
    t.sharedPrompt3,
  ];

  const focusOptions = ['all', 'fatigue', 'pain', 'gi', 'stress'];

  return (
    <div>
      <div style={s.pageTitle}>{t.sharedPageTitle}</div>
      <div style={s.pageSub}>{t.sharedPageSub(patient.disease)}</div>

      <div style={s.hero}>
        <div style={s.heroEyebrow}>{t.sharedEyebrow}</div>
        <div style={s.heroTitle}>{t.sharedHeroTitle}</div>
        <div style={s.heroText}>{t.sharedHeroText}</div>
        <div style={s.filterRow}>
          <button type="button" style={s.chip(similarOnly)} onClick={() => setSimilarOnly((v) => !v)}>
            {similarOnly ? t.sharedFilterSimilarOn : t.sharedFilterSimilarOff}
          </button>
          <button type="button" style={s.chip(hideDietary)} onClick={() => setHideDietary((v) => !v)}>
            {hideDietary ? t.sharedFilterDietOff : t.sharedFilterDietOn}
          </button>
          {focusOptions.map((option) => (
            <button
              key={option}
              type="button"
              style={s.chip(focus === option)}
              onClick={() => setFocus(option)}
            >
              {option === 'all' ? t.sharedFocusAll : t[FOCUS_LABEL_KEYS[option]]}
            </button>
          ))}
        </div>
      </div>

      <div style={s.grid}>
        <div style={s.card}>
          <div style={s.cardTitle}>{t.sharedPassiveTitle}</div>
          <div style={s.cardSub}>
            {t.sharedPassiveSub}
            {sharedSummary?.based_on_entries ? ` ${t.sharedBasedOnEntries(sharedSummary.based_on_entries)}.` : ''}
          </div>
          {passiveInsights.map((insight, index) => (
            <div key={index} style={s.insightItem}>
              <div style={s.insightText}>{insight}</div>
            </div>
          ))}
          {!sharedSummary?.based_on_entries && (
            <div style={s.empty}>{t.sharedNoSubmissions}</div>
          )}
          <div style={s.caution}>{t.sharedVariabilityNote}</div>
        </div>

        <div style={s.card}>
          <div style={s.cardTitle}>{t.sharedPatternTitle}</div>
          <div style={s.cardSub}>{t.sharedPatternSub}</div>
          {latestEntry ? (
            <>
              {topSymptoms.length > 0 && (
                <div style={s.listItem}>
                  <strong>{t.sharedTopSymptomsLabel}</strong> {topSymptoms.join(', ')}
                </div>
              )}
              <div style={s.listItem}>
                <strong>{t.sharedCurrentContextLabel}</strong> {contextTags.length ? contextTags.join(', ') : t.sharedNoStrongContext}
              </div>
              <div style={s.listItem}>
                <strong>{t.sharedSimilarityLabel}</strong> {similarOnly ? t.sharedSimilarityNarrow : t.sharedSimilarityBroad}
              </div>
            </>
          ) : (
            <div style={s.empty}>{t.sharedNoCheckins}</div>
          )}
        </div>
      </div>

      <div style={{ ...s.card, marginBottom: 20 }}>
        <div style={s.cardTitle}>{t.sharedStructuredTitle}</div>
        <div style={s.cardSub}>{t.sharedStructuredSub}</div>
        <div style={s.splitGrid}>
          <div style={s.splitBox('helpful')}>
            <div style={s.splitTitle('helpful')}>{t.sharedHelpfulTitle}</div>
            {helpfulDisplay.map((item, index) => <div key={index} style={s.bullet}>• {item}</div>)}
          </div>
          <div style={s.splitBox('unhelpful')}>
            <div style={s.splitTitle('unhelpful')}>{t.sharedUnhelpfulTitle}</div>
            {harderDisplay.map((item, index) => <div key={index} style={s.bullet}>• {item}</div>)}
          </div>
        </div>
        <div style={s.caution}>{t.sharedNonRecommendation}</div>
      </div>

      <div style={{ ...s.card, marginBottom: 20 }}>
        <div style={s.cardTitle}>{t.sharedWisdomTitle}</div>
        <div style={s.cardSub}>{t.sharedWisdomSub}</div>
        {wisdomSnippets.length ? (
          wisdomSnippets.map((snippet, index) => (
            <div key={index} style={s.listItem}>{snippet}</div>
          ))
        ) : (
          <div style={s.empty}>{t.sharedNoSubmissions}</div>
        )}
      </div>

      <div style={{ ...s.card, marginBottom: 20 }}>
        <div style={s.cardTitle}>{t.sharedPromptTitle}</div>
        <div style={s.cardSub}>{t.sharedPromptSub}</div>
        {prompts.map((prompt, index) => (
          <div key={index} style={s.listItem}>{prompt}</div>
        ))}
      </div>
    </div>
  );
}
