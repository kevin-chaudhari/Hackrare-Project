// src/pages/SignalVisualization.js — Enhanced with Disease-Specific Clinical Logs & 3D UI
import React, { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, ReferenceLine
} from 'recharts';
import { computeSignals, getHistory } from '../api';
import { useLang } from '../i18n/LanguageContext';
import theme from '../theme';

const RISK_COLORS = {
  LOW: theme.primary,
  MODERATE: theme.amber,
  HIGH: theme.amberDeep,
  CRITICAL: theme.coral,
  INSUFFICIENT_DATA: theme.textMuted
};

// ─── Disease-Specific Clinical Watch Log Data ────────────────────────────────
const DISEASE_CLINICAL_LOGS = {
  POTS: [
    { type: 'ALERT', icon: '🫀', title: 'Orthostatic HR Rise', body: 'Monitor for HR increase >30 bpm within 10 min of standing. A sustained rise signals autonomic instability.', zTrigger: 'heart_rate' },
    { type: 'WATCH', icon: '💧', title: 'Hydration & Salt Balance', body: 'Dehydration dramatically worsens POTS symptoms. Track fluid intake alongside daily HR variability.', zTrigger: null },
    { type: 'MILESTONE', icon: '📈', title: 'HRV Baseline Drift', body: 'A declining HRV trend over 7+ days may indicate worsening dysautonomia; consider cardiology review.', zTrigger: 'hrv_rmssd' },
    { type: 'NOTE', icon: '🛌', title: 'Sleep Position Impact', body: 'Elevated head-of-bed (10–20°) is a first-line intervention; log whether patient compliance correlates with morning HR.', zTrigger: null },
    { type: 'WATCH', icon: '🌡️', title: 'Heat Sensitivity Alert', body: 'Heat exposure (>28°C ambient) reliably triggers flares. Check lifestyle context for heat exposure notes.', zTrigger: null },
    { type: 'ALERT', icon: '🔄', title: 'Syncope / Presyncope Events', body: 'Patient-reported near-fainting episodes must trigger urgent orthostatic testing and medication review.', zTrigger: null },
  ],
  EDS: [
    { type: 'ALERT', icon: '🦴', title: 'Joint Subluxation Tracking', body: 'Subluxation frequency correlates with pain z-score spikes. Sudden increase may indicate need for splinting or PT referral.', zTrigger: null },
    { type: 'WATCH', icon: '💢', title: 'Chronic Pain Trajectory', body: 'Pain VAS trends upward for >5 consecutive days warrant analgesic review and physio escalation.', zTrigger: 'pain' },
    { type: 'MILESTONE', icon: '🧠', title: 'Cognitive Fog Correlation', body: 'EDS cognitive symptoms often co-occur with poor sleep and high pain days — check cross-signal clustering.', zTrigger: 'cognitive' },
    { type: 'NOTE', icon: '🩺', title: 'Skin Fragility Monitoring', body: 'Patients should report bruising onset; correlate with activity overexertion in lifestyle context.', zTrigger: null },
    { type: 'WATCH', icon: '🏃', title: 'Activity Overexertion Risk', body: 'EDS patients are prone to post-exertional malaise. Flag activity_load z-score if >1.5σ.', zTrigger: 'activity_load' },
  ],
  FMF: [
    { type: 'ALERT', icon: '🌡️', title: 'Fever Episode Pattern', body: 'FMF episodes last 12–72 h with fever >38.5°C. z-score spike in skin_temp_avg is a primary flare indicator.', zTrigger: 'skin_temp' },
    { type: 'WATCH', icon: '🫁', title: 'Serositis Watch (Chest/Abdomen)', body: 'Recurring chest or abdominal pain during fever clusters indicates pleuritis/peritonitis risk.', zTrigger: null },
    { type: 'MILESTONE', icon: '💊', title: 'Colchicine Adherence Proxy', body: 'Stable episode frequency with normal inter-flare z-scores suggests medication adherence; watch for sudden regression.', zTrigger: null },
    { type: 'NOTE', icon: '🧬', title: 'Amyloid Risk Monitoring', body: 'Long-term uncontrolled FMF raises secondary amyloidosis risk. Flag persistent high-risk periods for nephrologist co-management.', zTrigger: null },
    { type: 'ALERT', icon: '🦵', title: 'Arthritis / Joint Inflammation', body: 'Asymmetric joint swelling during febrile episodes is a FMF hallmark — log and correlate with HR spikes.', zTrigger: null },
  ],
  CF: [
    { type: 'ALERT', icon: '🫁', title: 'SpO₂ Desaturation Risk', body: 'SpO₂ below 94% at rest is a red-flag threshold for CF patients. Immediately escalate to pulmonologist.', zTrigger: 'spo2' },
    { type: 'WATCH', icon: '💨', title: 'Pulmonary Exacerbation Signs', body: 'Increased cough, sputum production, and declining activity tolerance indicate early exacerbation; initiate antibiotic escalation protocol.', zTrigger: 'activity_load' },
    { type: 'MILESTONE', icon: '📊', title: 'FEV₁ Proxy Tracking', body: 'Activity load and SpO₂ combined serve as a proxy for lung function trajectory between formal PFT tests.', zTrigger: null },
    { type: 'NOTE', icon: '🧂', title: 'Electrolyte & Salt Watch', body: 'CF patients lose excess salt in sweat; hydration and electrolyte balance are critical especially during summer months.', zTrigger: null },
    { type: 'ALERT', icon: '🦠', title: 'Infection Sentinel Events', body: 'Fever + HR elevation + activity decline triad strongly predicts pulmonary infection in CF. Escalate within 24 h.', zTrigger: 'heart_rate' },
  ],
  RTT: [
    { type: 'ALERT', icon: '💓', title: 'Prolonged QTc Risk', body: 'RTT carries high SUDEP risk. HR irregularities or high-max-HR readings demand immediate cardiac evaluation.', zTrigger: 'heart_rate' },
    { type: 'WATCH', icon: '😮‍💨', title: 'Breathing Irregularity Periods', body: 'Hyperventilation-apnea cycling is a RTT hallmark. SpO₂ dips correlate with neurological regression phases.', zTrigger: 'spo2' },
    { type: 'MILESTONE', icon: '🧠', title: 'Regression vs Stabilisation', body: 'Loss of purposeful hand use or communication skills are key regression markers — log alongside functional impact score.', zTrigger: 'cognitive' },
    { type: 'NOTE', icon: '🦴', title: 'Scoliosis Progression Watch', body: 'Worsening mobility z-scores may reflect spinal progression — coordinate orthopaedic review when functional impact on mobility rises.', zTrigger: null },
    { type: 'WATCH', icon: '🌙', title: 'Sleep Disturbance Tracking', body: 'RTT sleep disruption is common and worsens daytime function & seizure threshold. Cross-reference with FIS sleep domain.', zTrigger: 'sleep' },
  ],
  MFS: [
    { type: 'ALERT', icon: '❤️', title: 'Aortic Root Surveillance', body: 'MFS aortic root dilation risk is continuous. HR elevation above personal baseline raises mechanical stress — ensure cardiology is monitoring aortic diameter annually.', zTrigger: 'heart_rate' },
    { type: 'WATCH', icon: '👁️', title: 'Visual Disturbance Logging', body: 'New floaters, flashes, or visual field changes may indicate retinal detachment — log immediately and refer to ophthalmology.', zTrigger: null },
    { type: 'MILESTONE', icon: '📏', title: 'Height / Skeletal Proportion', body: 'Arm span > height ratio and arachnodactyly are diagnostic anchors; track any reported joint hypermobility changes.', zTrigger: null },
    { type: 'NOTE', icon: '🏋️', title: 'Exercise Restriction', body: 'Isometric high-intensity exercise is contraindicated. Flag activity_load z-scores >2σ for medication review.', zTrigger: 'activity_load' },
    { type: 'ALERT', icon: '🫁', title: 'Pneumothorax Risk', body: 'Sudden pleuritic chest pain or dyspnoea in MFS requires urgent imaging — elevated HR may be the only initial signal.', zTrigger: null },
  ],
  SMA: [
    { type: 'ALERT', icon: '🫁', title: 'Respiratory Muscle Failure', body: 'SMA respiratory function declines insidiously. SpO₂ trends below 96% at rest suggest early diaphragmatic involvement.', zTrigger: 'spo2' },
    { type: 'WATCH', icon: '💪', title: 'Motor Strength Trajectory', body: 'Activity load decline across multiple sessions is the earliest proxy for proximal muscle deterioration.', zTrigger: 'activity_load' },
    { type: 'MILESTONE', icon: '💊', title: 'Nusinersen / Risdiplam Response', body: 'Post-initiation of DMT: watch for activity recovery and FIS mobility improvement as treatment response markers.', zTrigger: null },
    { type: 'NOTE', icon: '🍽️', title: 'Nutritional Status', body: 'Swallowing difficulty and aspiration risk can emerge rapidly. Log meals / nutrition context and correlate with HR post-meal.', zTrigger: null },
    { type: 'WATCH', icon: '🛌', title: 'Nocturnal Hypoventilation', body: 'Night-time SpO₂ monitoring is essential. Poor recovery_score correlates with nocturnal breathing events.', zTrigger: 'recovery' },
  ],
  HD: [
    { type: 'ALERT', icon: '🧠', title: 'Chorea Severity Proxy', body: 'Elevated stress_load z-scores and declining activity correlate with chorea worsening — consider medication dose review.', zTrigger: 'stress' },
    { type: 'WATCH', icon: '💊', title: 'Tetrabenazine / Deutetrabenazine Monitoring', body: 'Sedation and depression are common side effects; track FIS cognitive domain and mood-related lifestyle notes.', zTrigger: 'cognitive' },
    { type: 'MILESTONE', icon: '📣', title: 'Dysarthria / Dysphagia Onset', body: 'Functional impact score decline in social + cognitive domains may precede formal speech therapy referral triggers.', zTrigger: null },
    { type: 'NOTE', icon: '❤️', title: 'Cardiac Arrhythmia Risk', body: 'HD is associated with cardiomyopathy — irregular HRV patterns and high-max HR should trigger cardiac workup.', zTrigger: 'hrv_rmssd' },
    { type: 'WATCH', icon: '🌙', title: 'Weight Loss & Metabolism', body: 'Hyperkinesis significantly increases caloric demand; activity load combined with recovery score tracks metabolic burden.', zTrigger: null },
  ],
  PKU: [
    { type: 'ALERT', icon: '🧠', title: 'Phenylalanine Control Proxy', body: 'Cognitive impact z-scores and stress_load elevation may signal dietary non-compliance or metabolic decompensation.', zTrigger: 'cognitive' },
    { type: 'WATCH', icon: '🍽️', title: 'Diet Adherence Monitoring', body: 'Large or unusual meals logged in lifestyle context can indicate dietary lapses — cross-reference with cognitive function.', zTrigger: null },
    { type: 'MILESTONE', icon: '💊', title: 'Sapropterin (BH4) Response', body: 'In BH4-responsive PKU, cognitive scores and functional impact should improve within weeks of treatment initiation.', zTrigger: null },
    { type: 'NOTE', icon: '🧬', title: 'Neuropsychiatric Watch', body: 'Anxiety, depression, and ADHD are comorbid in adolescent/adult PKU; HRV and stress metrics serve as biomarkers.', zTrigger: 'hrv_rmssd' },
  ],
  WD: [
    { type: 'ALERT', icon: '🟡', title: 'Hepatic Decompensation Signs', body: 'Skin_temp elevation + HR instability + declining recovery_score can indicate liver crisis — urgent hepatology review.', zTrigger: 'skin_temp' },
    { type: 'WATCH', icon: '🧠', title: 'Neuropsychiatric Deterioration', body: 'New personality changes, tremor, or cognitive decline are red flags in WD — correlate with FIS cognitive + social domains.', zTrigger: 'cognitive' },
    { type: 'MILESTONE', icon: '💊', title: 'Chelation Therapy Monitoring', body: 'D-penicillamine or trientine response: watch for gradual FIS improvement and stress_load stabilisation over 3–6 months.', zTrigger: null },
    { type: 'NOTE', icon: '👁️', title: 'Kayser-Fleischer Rings Follow-up', body: 'Document slit-lamp exam intervals; correlate neurological FIS scores with documented KF ring resolution progress.', zTrigger: null },
  ],
  NF1: [
    { type: 'ALERT', icon: '🧠', title: 'CNS Tumour Surveillance', body: 'New headaches, visual changes, or cognitive decline warrant urgent MRI — correlate with cognitive FIS and stress_load.', zTrigger: 'cognitive' },
    { type: 'WATCH', icon: '😟', title: 'Plexiform Neurofibroma Pain', body: 'Pain z-score elevation sustained >3 days should prompt imaging for plexiform growth or malignant transformation.', zTrigger: null },
    { type: 'MILESTONE', icon: '💊', title: 'Selumetinib (MEK Inhibitor) Response', body: 'Track activity_load and mobility FIS improvement as proxy for plexiform volume response on treatment.', zTrigger: 'activity_load' },
    { type: 'NOTE', icon: '🎓', title: 'Learning Disabilities Monitoring', body: 'Cognitive FIS trends are important; many NF1 patients have ADHD/dyslexia — cross-correlate with stress and sleep domains.', zTrigger: null },
  ],
  FXS: [
    { type: 'ALERT', icon: '💓', title: 'Cardiac Arrhythmia in FXTAS', body: 'Premutation carriers (FXTAS) develop autonomic dysfunction — elevated HRV deviation + HR max spikes need cardiac review.', zTrigger: 'hrv_rmssd' },
    { type: 'WATCH', icon: '🧠', title: 'Anxiety & Sensory Overload', body: 'Stress_load z-score is the best proxy for FXS anxiety spirals — correlate with activity worsening and emotional strain notes.', zTrigger: 'stress' },
    { type: 'MILESTONE', icon: '💊', title: 'Behavioral Medication Response', body: 'For patients on SSRIs/antipsychotics: track sleep FIS and stress over 4–8 weeks as treatment response indicators.', zTrigger: null },
    { type: 'NOTE', icon: '🌙', title: 'Sleep-Wake Cycle Disruption', body: 'FXS patients frequently have severe insomnia and early waking — sleep FIS domain decline is actionable.', zTrigger: 'sleep' },
  ],
  PCD: [
    { type: 'ALERT', icon: '🫁', title: 'Respiratory Exacerbation', body: 'SpO₂ drops combined with elevated HR and declining activity signal acute bronchiectasis exacerbation requiring antibiotic escalation.', zTrigger: 'spo2' },
    { type: 'WATCH', icon: '👂', title: 'Hearing & ENT Complications', body: 'Chronic otitis media is near-universal in PCD. Log ENT-related symptoms; correlate with activity decline.', zTrigger: null },
    { type: 'MILESTONE', icon: '🔄', title: 'Airway Clearance Adherence', body: 'Consistent use of airway clearance therapy (ACT) reflects in recovery_score stability — watch for regression.', zTrigger: 'recovery' },
    { type: 'NOTE', icon: '🧬', title: 'Fertility Implications', body: 'Male patients require discussion of infertility; females have risk of ectopic pregnancy — document in patient record.', zTrigger: null },
  ],
  Heterotaxy: [
    { type: 'ALERT', icon: '❤️', title: 'Complex CHD Cardiac Monitoring', body: 'SpO₂ variability in Heterotaxy with functional single ventricle requires urgent review — any SpO₂ <90% is critical.', zTrigger: 'spo2' },
    { type: 'WATCH', icon: '🫁', title: 'Asplenism Infection Risk', body: 'Patients with asplenia are severely immunocompromised — fever or HR elevation must prompt immediate sepsis rule-out.', zTrigger: 'heart_rate' },
    { type: 'MILESTONE', icon: '💊', title: 'Post-Fontan / Post-Surgical Status', body: 'Track activity load and recovery as proxies for Fontan circuit efficiency in single-ventricle patients.', zTrigger: 'activity_load' },
    { type: 'NOTE', icon: '🌡️', title: 'Lymphatic Complications', body: 'Protein-losing enteropathy and plastic bronchitis are late Fontan complications — recovery_score decline may be an early signal.', zTrigger: null },
  ],
  Pompe: [
    { type: 'ALERT', icon: '🫁', title: 'Diaphragmatic Weakness', body: 'SpO₂ decline at rest is a late sign — early detection relies on activity load reduction and recovery_score trends.', zTrigger: 'spo2' },
    { type: 'WATCH', icon: '💪', title: 'Proximal Muscle Deterioration', body: 'Activity load z-score declining across 2+ weeks strongly suggests proximal muscle progression requiring ERT dose review.', zTrigger: 'activity_load' },
    { type: 'MILESTONE', icon: '💊', title: 'ERT (Alglucosidase) Response', body: 'Following ERT initiation or dose change, expect activity_load and mobility FIS improvement within 12–16 weeks.', zTrigger: null },
    { type: 'NOTE', icon: '🦷', title: 'Skeletal & Bone Health', body: 'Osteoporosis is common in adult Pompe; activity restrictions worsen it — review calcium supplementation and DEXA intervals.', zTrigger: null },
  ],
  TS: [
    { type: 'ALERT', icon: '❤️', title: 'Bicuspid Aortic Valve Surveillance', body: 'TS patients have 30% risk of aortic dissection — HR max spikes and unexplained chest discomfort must be escalated.', zTrigger: 'heart_rate' },
    { type: 'WATCH', icon: '🔵', title: 'Lymphedema & Growth', body: 'Limb edema and short stature are hallmarks; activity_load and mobility FIS reflect functional impact of lymphedema.', zTrigger: 'activity_load' },
    { type: 'MILESTONE', icon: '💊', title: 'Growth Hormone / Oestrogen Therapy', body: 'Track FIS composite improvement and activity_load as response to GH or oestrogen replacement therapy.', zTrigger: null },
    { type: 'NOTE', icon: '🧠', title: 'Cognitive & Social Development', body: 'TS is associated with specific visuospatial and social-cognitive deficits; FIS cognitive + social domains should be tracked.', zTrigger: null },
    { type: 'WATCH', icon: '🦴', title: 'Osteoporosis Risk', body: 'Hypogonadism + low oestrogen accelerates bone loss — correlate activity load with HRT compliance data.', zTrigger: null },
  ],
  Gaucher: [
    { type: 'ALERT', icon: '🩸', title: 'Thrombocytopenia & Anaemia', body: 'Severe bruising or bleeding tendency with declining recovery_score signals bone marrow infiltration — urgent haematology review.', zTrigger: 'recovery' },
    { type: 'WATCH', icon: '🫁', title: 'Lung Infiltration Watch', body: 'SpO₂ dips and declining activity in Gaucher Type 1 may indicate pulmonary infiltration — monitor alongside imaging schedule.', zTrigger: 'spo2' },
    { type: 'MILESTONE', icon: '💊', title: 'ERT (Imiglucerase) Response', body: 'After 6 months of ERT, activity_load and FIS composite improvement signal treatment efficacy.', zTrigger: 'activity_load' },
    { type: 'NOTE', icon: '🦴', title: 'Avascular Necrosis Risk', body: 'Bone crises present as severe episodic pain — correlate pain z-score spikes with activity and temperature fluctuations.', zTrigger: null },
  ],
  Alkaptonuria: [
    { type: 'ALERT', icon: '🦴', title: 'Ochronotic Arthropathy', body: 'Joint pain z-scores correlating with activity load indicate progressive cartilage deposition — escalate to rheumatology.', zTrigger: null },
    { type: 'WATCH', icon: '❤️', title: 'Cardiac Valve Calcification', body: 'HR irregularity and declining recovery score may reflect aortic stenosis progression — annual echocardiogram is recommended.', zTrigger: 'heart_rate' },
    { type: 'MILESTONE', icon: '💊', title: 'Nitisinone Therapy Monitoring', body: 'Track activity_load and FIS mobility improvement as proxies for joint function response to nitisinone treatment.', zTrigger: 'activity_load' },
    { type: 'NOTE', icon: '🫁', title: 'Pulmonary Fibrosis Surveillance', body: 'End-stage AKU can involve restrictive lung disease — SpO₂ trends and activity tolerance provide early signals.', zTrigger: 'spo2' },
  ],
  Achondroplasia: [
    { type: 'ALERT', icon: '🧠', title: 'Foramen Magnum Compression', body: 'Sudden onset of sleep apnoea symptoms, reduced activity, or neurological changes demands urgent cervical spine imaging.', zTrigger: null },
    { type: 'WATCH', icon: '🫁', title: 'Obstructive Sleep Apnoea', body: 'SpO₂ desaturation during recovery + poor recovery_score is a strong proxy for sleep-disordered breathing.', zTrigger: 'spo2' },
    { type: 'MILESTONE', icon: '💊', title: 'Vosoritide Growth Therapy', body: 'Children on vosoritide: track activity load and mobility FIS as functional response indicators over 12+ months.', zTrigger: 'activity_load' },
    { type: 'NOTE', icon: '🦴', title: 'Spinal Stenosis Monitoring', body: 'Back pain z-score and declining mobility FIS domain in adults indicates progressive spinal stenosis — refer to neurosurgery.', zTrigger: null },
  ],
  RRP: [
    { type: 'ALERT', icon: '🎤', title: 'Airway Obstruction Risk', body: 'SpO₂ desaturation is a late and dangerous sign of laryngeal obstruction — any drop from baseline demands same-day evaluation.', zTrigger: 'spo2' },
    { type: 'WATCH', icon: '🫁', title: 'Pulmonary Spread Detection', body: 'Declining activity_load + SpO₂ in older patients suggests distal spread of HPV-related papillomatosis.', zTrigger: 'activity_load' },
    { type: 'MILESTONE', icon: '💊', title: 'Bevacizumab / Cidofovir Response', body: 'Track HR, activity, and SpO₂ trends following adjuvant therapy — improvement suggests controlled disease.', zTrigger: null },
    { type: 'NOTE', icon: '😰', title: 'Psychological Burden', body: 'Chronic voice loss and repeated surgeries significantly impact mental wellbeing — FIS social + stress domains reflect this.', zTrigger: null },
  ],
  ENS: [
    { type: 'ALERT', icon: '🫀', title: 'Vasovagal Episodes', body: 'HRV depression + low HR_resting may predict vasovagal syncope events — correlate with activity and stress periods.', zTrigger: 'hrv_rmssd' },
    { type: 'WATCH', icon: '🥗', title: 'Post-Prandial Symptoms', body: 'Patients report significant post-meal bloating and pain — large or unusual meal logs should be cross-referenced with HR spikes.', zTrigger: null },
    { type: 'MILESTONE', icon: '🔁', title: 'Motility Treatment Response', body: 'Track recovery_score and stress_load stability as proxies for gastrointestinal function improvement over 4–8 weeks.', zTrigger: 'recovery' },
    { type: 'NOTE', icon: '🧠', title: 'Gut-Brain Axis Monitoring', body: 'Stress_load z-scores consistently predict ENS flares — psychosocial intervention alongside medical management is evidence-based.', zTrigger: 'stress' },
  ],
  PRION: [
    { type: 'ALERT', icon: '🧠', title: 'Rapid Cognitive Decline', body: 'Steep FIS cognitive domain decline over days-to-weeks is the hallmark of prion disease — palliative and neurology co-involvement is urgent.', zTrigger: 'cognitive' },
    { type: 'WATCH', icon: '💓', title: 'Autonomic Instability', body: 'HRV chaotic patterns and HR_max spikes may reflect diencephalic involvement in prion disease progression.', zTrigger: 'hrv_rmssd' },
    { type: 'MILESTONE', icon: '📋', title: 'Prognosis & Supportive Care', body: 'Establish goals of care early. Functional impact composite decline trajectory is the primary monitoring outcome.', zTrigger: null },
    { type: 'NOTE', icon: '🌙', title: 'Sleep Architecture Disruption', body: 'Fatal familial insomnia (FFI subtype) presents with profound sleep disruption — FIS sleep domain is critical to track.', zTrigger: 'sleep' },
    { type: 'WATCH', icon: '😮‍💨', title: 'Myoclonus & Movement', body: 'Stress_load and activity_load erratic patterns can precede clinical recognition of myoclonus — alert neurology early.', zTrigger: 'stress' },
  ],
};

// Fallback for any disease not explicitly listed
const DEFAULT_LOGS = [
  { type: 'NOTE', icon: '🩺', title: 'Baseline Monitoring', body: 'Track z-score trends across all symptoms to identify emerging deviations from individual baseline.', zTrigger: null },
  { type: 'WATCH', icon: '📈', title: 'Volatility Index', body: 'A volatility index above moderate threshold for 5+ consecutive days warrants clinical review.', zTrigger: null },
  { type: 'ALERT', icon: '⚠️', title: 'Red Flag Symptoms', body: 'Any symptom z-score exceeding +2σ should be reviewed in context of current medication and lifestyle data.', zTrigger: null },
  { type: 'NOTE', icon: '💊', title: 'Medication & Context', body: 'Cross-reference signal spikes with lifestyle context entries (travel, illness, stress) before escalating management.', zTrigger: null },
];

const LOG_TYPE_CONFIG = {
  ALERT: { color: theme.coral, bg: theme.coralBg, border: theme.coralDeep, label: 'ALERT', dot: '🔴' },
  WATCH: { color: theme.amber, bg: theme.amberBg, border: theme.amberDeep, label: 'WATCH', dot: '🟡' },
  MILESTONE: { color: theme.teal, bg: theme.tealBg, border: theme.teal, label: 'MILESTONE', dot: '🔵' },
  NOTE: { color: theme.textMuted, bg: 'rgba(143,163,184,0.08)', border: theme.border, label: 'NOTE', dot: '⚪' },
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = {
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 },
  card: {
    background: theme.glass,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderRadius: 16,
    padding: 24,
    border: `1px solid ${theme.border}`,
    color: theme.text,
    boxShadow: theme.shadow3d,
    transition: 'transform 0.25s ease, box-shadow 0.25s ease',
    position: 'relative',
    overflow: 'hidden',
  },
  cardHoverStyle: {
    transform: 'perspective(800px) translateY(-3px) rotateX(1deg)',
    boxShadow: `${theme.shadowFloat}, 0 0 0 1px ${theme.borderGlow}`,
  },
  cardShine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1,
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
    pointerEvents: 'none',
  },
  title: { fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 },
  riskBadge: (r) => ({
    display: 'inline-block', padding: '4px 14px', borderRadius: 20, fontWeight: 800, fontSize: 14,
    background: `${RISK_COLORS[r]}22` || theme.surfaceAlt, color: RISK_COLORS[r] || theme.textMuted,
    border: `1px solid ${RISK_COLORS[r] || theme.border}`,
    boxShadow: `0 0 12px ${RISK_COLORS[r] || 'transparent'}33`,
  }),
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 18 },
  stat: {
    background: theme.glassLight,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    borderRadius: 14,
    padding: '18px 20px',
    border: `1px solid ${theme.borderSoft}`,
    textAlign: 'center',
    boxShadow: theme.shadowSoft,
    position: 'relative',
    overflow: 'hidden',
  },
  statVal: { fontSize: 28, fontWeight: 800, color: theme.teal },
  statLabel: { fontSize: 11, color: theme.textMuted, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
  refreshBtn: {
    background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDeep})`,
    color: '#fff', border: 'none', borderRadius: 10, padding: '9px 22px',
    fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 20,
    display: 'flex', alignItems: 'center', gap: 6,
    boxShadow: '0 4px 16px rgba(63, 185, 80, 0.3)',
    transition: 'all 0.18s',
  },
  loading: { padding: 60, textAlign: 'center', color: theme.textMuted },
  zRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${theme.border}` },
  zName: { fontSize: 13, color: theme.textSoft, textTransform: 'capitalize' },
  zVal: (v) => ({
    fontWeight: 700, fontSize: 13,
    color: Math.abs(v) >= 2 ? theme.coral : Math.abs(v) >= 1 ? theme.amber : theme.primary,
    background: `${Math.abs(v) >= 2 ? theme.coral : Math.abs(v) >= 1 ? theme.amber : theme.primary}1a`,
    padding: '2px 10px', borderRadius: 20,
  }),
  noData: { textAlign: 'center', padding: '40px 0', color: theme.textMuted, fontSize: 14 },
  pageTitle: { fontSize: 26, fontWeight: 800, color: theme.text, letterSpacing: '-0.5px', marginBottom: 4 },
  pageSub: { fontSize: 14, color: theme.textMuted, marginBottom: 24 },
};

// ─── HoverCard wrapper ───────────────────────────────────────────────────────
function HoverCard({ style, children }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ ...s.card, ...style, ...(hovered ? s.cardHoverStyle : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={s.cardShine} />
      {children}
    </div>
  );
}

// ─── Clinical Watch Log Entry ─────────────────────────────────────────────────
function ClinicalLogEntry({ entry, index, zScoreData, signals }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = LOG_TYPE_CONFIG[entry.type] || LOG_TYPE_CONFIG.NOTE;

  // Check if this entry's trigger symptom has an elevated z-score
  const isLive = entry.zTrigger && zScoreData.some(d => {
    const nameMatch = d.name.toLowerCase().includes(entry.zTrigger.toLowerCase()) ||
      (entry.zTrigger === 'heart_rate' && d.name.toLowerCase().includes('heart'));
    return nameMatch && Math.abs(d.z) >= 1.5;
  });

  const isCritical = isLive && zScoreData.some(d => {
    const nameMatch = d.name.toLowerCase().includes(entry.zTrigger?.toLowerCase() || '') ||
      (entry.zTrigger === 'heart_rate' && d.name.toLowerCase().includes('heart'));
    return nameMatch && Math.abs(d.z) >= 2.5;
  });

  return (
    <div
      style={{
        display: 'flex', gap: 14, marginBottom: 0,
        padding: '14px 0',
        borderBottom: `1px solid ${theme.border}`,
        cursor: 'pointer',
        transition: 'opacity 0.15s',
        animation: `fadeSlideIn 0.3s ease ${index * 0.06}s both`,
      }}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Timeline spine */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 32 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: cfg.bg, border: `2px solid ${cfg.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15,
          boxShadow: isCritical ? `0 0 14px ${cfg.color}88` : isLive ? `0 0 8px ${cfg.color}55` : 'none',
          transition: 'box-shadow 0.3s',
        }}>
          {entry.icon}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase',
            padding: '2px 8px', borderRadius: 20,
            background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
          }}>{cfg.label}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{entry.title}</span>
          {isLive && (
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase',
              padding: '2px 8px', borderRadius: 20, marginLeft: 'auto',
              background: isCritical ? theme.coralBg : theme.amberBg,
              color: isCritical ? theme.coral : theme.amber,
              border: `1px solid ${isCritical ? theme.coralDeep : theme.amberDeep}`,
              boxShadow: isCritical ? `0 0 8px ${theme.coral}55` : `0 0 4px ${theme.amber}33`,
              animation: 'pulse 2s ease-in-out infinite',
            }}>
              {isCritical ? '🔴 ACTIVE CRITICAL' : '🟡 ACTIVE WATCH'}
            </span>
          )}
          <span style={{ marginLeft: isLive ? 0 : 'auto', fontSize: 11, color: theme.textMuted }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
        {expanded && (
          <div style={{
            fontSize: 12.5, color: theme.textSoft, lineHeight: 1.75,
            marginTop: 8, paddingTop: 8,
            borderTop: `1px dashed ${theme.border}`,
            animation: 'fadeSlideIn 0.2s ease',
          }}>
            {entry.body}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Clinical Watch Log Panel ─────────────────────────────────────────────────
function ClinicalWatchLog({ patient, zScoreData, signals }) {
  const logs = DISEASE_CLINICAL_LOGS[patient.disease] || DEFAULT_LOGS;
  const activeCount = logs.filter(entry =>
    entry.zTrigger && zScoreData.some(d => {
      const nm = d.name.toLowerCase();
      const zt = entry.zTrigger.toLowerCase();
      return (nm.includes(zt) || (zt === 'heart_rate' && nm.includes('heart'))) && Math.abs(d.z) >= 1.5;
    })
  ).length;

  return (
    <HoverCard style={{ gridColumn: 'span 2' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div>
          <div style={{ ...s.title, marginBottom: 0 }}>🩺 Clinical Watch Log — {patient.disease}</div>
          <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
            Disease-specific monitoring events for clinical decision support. Click any entry to expand rationale.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {activeCount > 0 && (
            <div style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 800,
              background: theme.coralBg, color: theme.coral, border: `1px solid ${theme.coralDeep}`,
              boxShadow: `0 0 12px ${theme.coral}44`,
              animation: 'pulse 2s ease-in-out infinite',
            }}>
              {activeCount} Active Signal{activeCount > 1 ? 's' : ''}
            </div>
          )}
          <div style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: theme.tealBg, color: theme.teal, border: `1px solid ${theme.teal}`,
          }}>
            {logs.length} Watch Items
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, marginTop: 12, flexWrap: 'wrap' }}>
        {Object.entries(LOG_TYPE_CONFIG).map(([type, cfg]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color, boxShadow: `0 0 6px ${cfg.color}66` }} />
            <span style={{ fontSize: 11, color: theme.textMuted, fontWeight: 600 }}>{cfg.label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: theme.amber }}>🟡 ACTIVE WATCH</span>
          <span style={{ fontSize: 10, color: theme.textMuted }}>= live signal detected ≥1.5σ</span>
        </div>
      </div>

      {/* Log entries */}
      <div>
        {logs.map((entry, i) => (
          <ClinicalLogEntry
            key={i}
            index={i}
            entry={entry}
            zScoreData={zScoreData}
            signals={signals}
          />
        ))}
      </div>
    </HoverCard>
  );
}

function formatSymptomLabel(symptomKey) {
  const words = symptomKey.split('_').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1));
  const label = words.join(' ');
  return label.length > 22 ? `${label.slice(0, 22).trimEnd()}...` : label;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SignalVisualization({ patient }) {
  const { t } = useLang();
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

  if (loading && !signals) return <div style={s.loading}>{t.computeFirst}</div>;

  const displayRiskLabel = (risk) => t.riskDisplayLabels?.[risk] || risk;
  const displayLevelLabel = (label) => t.levelLabels?.[label] || (label ? label.toUpperCase() : '—');

  const fis = signals?.functional_impact || {};
  const radarData = [
    { domain: t.signalDomains.mobility, value: Math.round((fis.mobility || 0) * 100) },
    { domain: t.signalDomains.cognitive, value: Math.round((fis.cognitive || 0) * 100) },
    { domain: t.signalDomains.sleep, value: Math.round((fis.sleep || 0) * 100) },
    { domain: t.signalDomains.work, value: Math.round((fis.work || 0) * 100) },
    { domain: t.signalDomains.social, value: Math.round((fis.social || 0) * 100) },
  ];

  const zScoreData = signals ? Object.entries(signals.z_scores || {}).map(([sym, d]) => ({
    name: formatSymptomLabel(sym),
    z: parseFloat(d.z_score?.toFixed(2) || 0),
    current: parseFloat(d.value?.toFixed(1) || 0),
    baseline: parseFloat(d.baseline_mu?.toFixed(1) || 0),
  })) : [];

  return (
    <>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.65; }
        }
      `}</style>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, color: theme.text, fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>
              {t.signalDashboardTitle(patient.disease)}
            </h2>
            <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 3 }}>
              Real-time signal analysis with disease-specific clinical watch log
            </div>
          </div>
          <button style={s.refreshBtn} onClick={refresh} disabled={loading}>
            {loading ? t.refreshingSignals : t.refreshSignals}
          </button>
        </div>

        {/* Stats Row */}
        {signals && (
          <div style={s.statGrid}>
            <div style={s.stat}>
              <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at top, ${theme.tealGlow}, transparent 70%)`, pointerEvents: 'none' }} />
              <div style={s.statVal}>{signals.volatility?.value?.toFixed(2) || '—'}</div>
              <div style={s.statLabel}>{t.volatilityIndexLabel}</div>
              <div style={{ fontSize: 11, color: { high: theme.amberDeep, moderate: theme.amber, low: theme.primary }[signals.volatility?.label] || theme.textMuted, marginTop: 4, fontWeight: 700 }}>
                {displayLevelLabel(signals.volatility?.label)}
              </div>
            </div>
            <div style={s.stat}>
              <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at top, ${theme.tealGlow}, transparent 70%)`, pointerEvents: 'none' }} />
              <div style={s.statVal}>{fis.composite ? (fis.composite * 100).toFixed(0) + '%' : '—'}</div>
              <div style={s.statLabel}>{t.functionalImpactLabel}</div>
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>{displayLevelLabel(fis.severity_label)}</div>
            </div>
            <div style={s.stat}>
              <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at top, ${theme.tealGlow}, transparent 70%)`, pointerEvents: 'none' }} />
              <div style={{ ...s.statVal }}>
                <span style={s.riskBadge(signals.risk_category)}>{displayRiskLabel(signals.risk_category)}</span>
              </div>
              <div style={s.statLabel}>{t.riskCategoryLabel}</div>
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>
                {signals.missingness?.completeness_pct?.toFixed(0)}% {t.completeSuffix}
              </div>
            </div>
          </div>
        )}

        <div style={s.grid}>
          {/* Z-Score Bar Chart */}
          <HoverCard>
            <div style={s.title}>{t.signalDeviationTitle}</div>
            {zScoreData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={zScoreData} layout="vertical" margin={{ left: 148, right: 20, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme.border} />
                  <XAxis type="number" domain={[-4, 4]} tickCount={9} tick={{ fill: theme.textMuted, fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: theme.textMuted }} tickLine={{ stroke: theme.textMuted }} />
                  <Tooltip
                    contentStyle={{ background: theme.glassStrong, border: `1px solid ${theme.border}`, borderRadius: 10, color: theme.text, backdropFilter: 'blur(8px)' }}
                    formatter={(v) => [`${v}σ`, t.zScoreLegend]}
                  />
                  <ReferenceLine x={0} stroke={theme.textSoft} strokeWidth={2} />
                  <ReferenceLine x={2} stroke={theme.coral} strokeDasharray="4 2" strokeWidth={1.5} label={{ value: '+2σ', position: 'top', fontSize: 10, fill: theme.coral }} />
                  <ReferenceLine x={-2} stroke={theme.coral} strokeDasharray="4 2" strokeWidth={1.5} />
                  <Bar dataKey="z" name={t.zScoreLegend} fill={theme.teal} radius={[0, 4, 4, 0]}
                    label={{ position: 'right', fontSize: 10, fill: theme.textSoft, formatter: v => v > 0 ? `+${v}` : v }} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={s.noData}>{t.logSymptomsForDeviations}</div>}
          </HoverCard>

          {/* FIS Radar */}
          <HoverCard>
            <div style={s.title}>{t.functionalImpactByDomain}</div>
            {fis.composite > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={80}>
                  <PolarGrid stroke={theme.border} />
                  <PolarAngleAxis dataKey="domain" tick={{ fontSize: 12, fill: theme.textMuted }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: theme.textMuted }} />
                  <Radar name="FIS" dataKey="value" stroke={theme.teal} fill={theme.teal} fillOpacity={0.28} />
                  <Tooltip
                    contentStyle={{ background: theme.glassStrong, border: `1px solid ${theme.border}`, borderRadius: 10, color: theme.text }}
                    formatter={(v) => [`${v}%`, t.impactLegend]}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : <div style={s.noData}>{t.noFunctionalImpactYet}</div>}
          </HoverCard>

          {/* Longitudinal History */}
          <HoverCard style={{ gridColumn: 'span 2' }}>
            <div style={s.title}>{t.longitudinalHistoryTitle}</div>
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={history} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: theme.textMuted }} />
                  <YAxis yAxisId="left" domain={[0, 4]} tick={{ fontSize: 10, fill: theme.textMuted }} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 1]} tick={{ fontSize: 10, fill: theme.textMuted }} />
                  <Tooltip
                    contentStyle={{ background: theme.glassStrong, border: `1px solid ${theme.border}`, borderRadius: 10, color: theme.text }}
                  />
                  <Legend wrapperStyle={{ color: theme.textMuted, fontSize: 12 }} />
                  <ReferenceLine yAxisId="left" y={2} stroke={theme.coral} strokeDasharray="4 2" strokeWidth={1.5}
                    label={{ value: t.threshold2Sigma, fontSize: 10, fill: theme.coral }} />
                  <Line yAxisId="left" type="monotone" dataKey="z_score_max" name={t.maxZScoreLegend} stroke={theme.coral} strokeWidth={2.5} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="volatility_index" name={t.volatilityIndexLabel} stroke={theme.amber} strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="fis_composite" name="FIS Composite" stroke={theme.teal} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div style={s.noData}>{t.longitudinalHistoryEmpty}</div>}
          </HoverCard>

          {/* ── Disease-Specific Clinical Watch Log ────────────────────── */}
          <ClinicalWatchLog patient={patient} zScoreData={zScoreData} signals={signals} />
        </div>

        {/* Trigger Correlations */}
        {signals?.trigger_correlations?.length > 0 && (
          <HoverCard style={{ marginBottom: 16 }}>
            <div style={s.title}>{t.triggerAssocAnalysis}</div>
            {signals.trigger_correlations.map((tc, i) => (
              <div key={i} style={s.zRow}>
                <span style={s.zName}>{tc.trigger.replace(/_/g, ' ')}</span>
                <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {tc.significant && (
                    <span style={{ fontSize: 11, background: theme.amberBg, color: theme.amber, padding: '2px 8px', borderRadius: 10 }}>
                      {t.significantLabel}
                    </span>
                  )}
                  <span style={s.zVal(tc.correlation)}>r = {tc.correlation > 0 ? '+' : ''}{tc.correlation.toFixed(3)}</span>
                  <span style={{ fontSize: 11, color: theme.textMuted }}>p={tc.p_value.toFixed(3)}</span>
                </span>
              </div>
            ))}
          </HoverCard>
        )}

        {signals?.red_flags?.length > 0 && (
          <div style={{
            background: `${theme.coralBg}`,
            border: `1px solid ${theme.coralDeep}`,
            borderRadius: 12,
            padding: '16px 20px',
            marginTop: 16,
            backdropFilter: 'blur(8px)',
            boxShadow: theme.shadowCoral,
          }}>
            <div style={{ fontWeight: 700, color: theme.coral, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ animation: 'pulse 1.5s ease-in-out infinite', display: 'inline-block' }}>🔴</span>
              {t.redFlagsDetected}
            </div>
            {signals.red_flags.map((rf, i) => (
              <div key={i} style={{ color: theme.coral, fontSize: 14, marginBottom: 4 }}>• {rf.replace(/_/g, ' ')}</div>
            ))}
            <div style={{ fontSize: 12, color: theme.coral, marginTop: 10, fontStyle: 'italic' }}>{t.careTeamDisclaimer}</div>
          </div>
        )}
      </div>
    </>
  );
}
