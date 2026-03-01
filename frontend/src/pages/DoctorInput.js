// DoctorInput.js — Doctor-facing symptom entry: Manual sliders, PDF NLP, CSV upload
import React, { useState, useEffect, useRef } from 'react';
import { addEntry, getDiseaseConfig, computeSignals, uploadSymptomCSV, uploadSymptomPDF } from '../api';
import { useLang } from '../i18n/LanguageContext';
import theme from '../theme';

// ─── Shared helpers ────────────────────────────────────────────────────────────
const sevCol = (v) => v >= 7 ? theme.coral : v >= 4 ? theme.amber : theme.primary;
const fmtSym = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const CONFIDENCE_COL = (c) => c >= 80 ? '#22c55e' : c >= 60 ? '#facc15' : '#fb923c';

function GlassCard({ children, style = {} }) {
    return (
        <div style={{
            background: 'rgba(15,22,35,0.72)',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(95,179,162,0.22)',
            borderRadius: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            ...style,
        }}>{children}</div>
    );
}

function TabBtn({ active, onClick, icon, label }) {
    return (
        <button onClick={onClick} style={{
            flex: 1, padding: '12px 8px',
            background: active ? 'rgba(95,179,162,0.18)' : 'transparent',
            border: 'none',
            borderBottom: active ? `2px solid ${theme.teal}` : '2px solid transparent',
            color: active ? theme.teal : theme.textMuted,
            fontSize: 13, fontWeight: active ? 700 : 400, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'all 0.15s',
        }}>
            <span>{icon}</span> {label}
        </button>
    );
}

function SuccessMsg({ text }) {
    return (
        <div style={{
            background: `${theme.primary}18`, border: `1px solid ${theme.primary}`,
            borderRadius: 10, padding: '10px 14px', marginTop: 12,
            color: theme.primary, fontSize: 13,
        }}>{text}</div>
    );
}

function ErrorMsg({ text }) {
    return (
        <div style={{
            background: `${theme.coral}18`, border: `1px solid ${theme.coral}`,
            borderRadius: 10, padding: '10px 14px', marginTop: 12,
            color: theme.coral, fontSize: 13,
        }}>{text}</div>
    );
}

// ── Big "saved" confirmation banner shown after a successful save + signal recompute ──
function SavedBanner({ entryId, importedCount, onReset }) {
    return (
        <GlassCard style={{ padding: 28, textAlign: 'center', border: `1.5px solid ${theme.teal}`, marginBottom: 20 }}>
            <div style={{ fontSize: 42, marginBottom: 10 }}>🎉</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: theme.teal, marginBottom: 6 }}>
                {importedCount != null ? `${importedCount} entries saved!` : `Entry #${entryId} saved!`}
            </div>
            <div style={{ color: theme.textMuted, fontSize: 13, marginBottom: 18, lineHeight: 1.7 }}>
                Symptom log committed to the database.<br />
                <b style={{ color: theme.primary }}>✅ Signals recomputed</b> — Clinician View &amp; History charts are now up to date.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={onReset} style={{
                    padding: '10px 24px',
                    background: `linear-gradient(135deg, ${theme.teal}, ${theme.primary})`,
                    border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>
                    + Log another entry
                </button>
            </div>
        </GlassCard>
    );
}

// ─── Shared doctor-mode context helpers ───────────────────────────────────────
function DocYesNoBtn({ value, current, onSelect, label }) {
    const active = current === value;
    const col = value === 'yes' ? theme.coral : value === 'no' ? theme.primary : theme.amber;
    return (
        <button onClick={() => onSelect(value)} style={{
            flex: 1, padding: '8px 0', borderRadius: 8,
            border: `1.5px solid ${active ? col : theme.borderSoft}`,
            background: active ? `${col}18` : 'transparent',
            color: active ? col : theme.textMuted,
            fontSize: 12, fontWeight: active ? 700 : 400, cursor: 'pointer', transition: 'all 0.15s',
        }}>{label || value.charAt(0).toUpperCase() + value.slice(1)}</button>
    );
}

function DocChoiceRow({ label, fieldKey, choices, ctx, setCtx }) {
    return (
        <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: theme.textSoft, marginBottom: 6 }}>{label}</div>
            <div style={{ display: 'flex', gap: 6 }}>
                {choices.map(c => (
                    <DocYesNoBtn key={c.v} value={c.v} current={ctx[fieldKey]}
                        label={c.l} onSelect={v => setCtx(p => ({ ...p, [fieldKey]: v }))} />
                ))}
            </div>
        </div>
    );
}

function DayContextPanel({ ctx, setCtx }) {
    const { t } = useLang();
    const [showExtra, setShowExtra] = useState(false);
    const secHead = (txt) => (
        <div style={{
            fontSize: 10, fontWeight: 700, color: theme.teal, textTransform: 'uppercase',
            letterSpacing: 1.4, marginBottom: 12, marginTop: 4, paddingBottom: 5,
            borderBottom: `1px solid ${theme.teal}28`,
        }}>{txt}</div>
    );
    const sleepH = ctx.sleep_duration_hours ?? 8;
    const setSleep = v => setCtx(p => ({ ...p, sleep_duration_hours: Math.max(0, Math.min(24, Math.round(v * 2) / 2)) }));

    return (
        <GlassCard style={{ padding: 22, marginTop: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 }}>
                🌙 {t.contextTitle}
            </div>
            <div style={{ color: theme.textMuted, fontSize: 12, marginBottom: 18, lineHeight: 1.6 }}>
                {t.contextSub}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
                {/* Left col */}
                <div>
                    {secHead(`💤 ${t.sleepDomain}`)}
                    <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: theme.textSoft, marginBottom: 6 }}>{t.sleepDurationLabel}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button onClick={() => setSleep(sleepH - 0.5)} style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${theme.borderSoft}`, background: 'transparent', color: theme.textSoft, fontSize: 16, cursor: 'pointer' }}>−</button>
                            <div style={{ flex: 1, textAlign: 'center' }}>
                                <span style={{ fontSize: 20, fontWeight: 800, color: theme.teal }}>{sleepH.toFixed(1)}</span>
                                <span style={{ fontSize: 12, color: theme.textMuted, marginLeft: 4 }}>{t.sleepDurationHours(sleepH).replace(`${sleepH.toFixed(1)} `, '')}</span>
                            </div>
                            <button onClick={() => setSleep(sleepH + 0.5)} style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${theme.borderSoft}`, background: 'transparent', color: theme.textSoft, fontSize: 16, cursor: 'pointer' }}>+</button>
                        </div>
                    </div>
                    <DocChoiceRow label={t.sleepDisruptionLabel} fieldKey="sleep_disruption"
                        choices={[{ v: 'yes', l: t.choiceYes }, { v: 'no', l: t.choiceNo }]}
                        ctx={ctx} setCtx={setCtx} />

                    {secHead(`🏃 ${t.activityDomain}`)}
                    <DocChoiceRow label={t.activityLevelLabel} fieldKey="activity_level"
                        choices={[{ v: 'low', l: t.choiceLow }, { v: 'moderate', l: t.choiceModerate }, { v: 'high', l: t.choiceHigh }]}
                        ctx={ctx} setCtx={setCtx} />

                    {secHead(`🧠 ${t.stressDomain}`)}
                    <DocChoiceRow label={t.mentallyDemandingLabel} fieldKey="mentally_demanding_day"
                        choices={[{ v: 'yes', l: t.choiceYes }, { v: 'no', l: t.choiceNo }]}
                        ctx={ctx} setCtx={setCtx} />

                    {secHead(`💧 ${t.hydrationDomain}`)}
                    <DocChoiceRow label={t.hydrationLabel} fieldKey="hydration_level"
                        choices={[{ v: 'low', l: t.choiceLow }, { v: 'adequate', l: t.choiceAdequate }, { v: 'high', l: t.choiceHigh }]}
                        ctx={ctx} setCtx={setCtx} />
                </div>

                {/* Right col — extra context (always visible in doctor mode) */}
                <div>
                    {secHead(`🏃 ${t.activityDomain} (${t.contextMore.toLowerCase()})`)}
                    <DocChoiceRow label={t.overexertionLabel} fieldKey="overexertion"
                        choices={[{ v: 'yes', l: t.choiceYes }, { v: 'no', l: t.choiceNo }]}
                        ctx={ctx} setCtx={setCtx} />
                    <DocChoiceRow label={t.activityWorsenedLabel} fieldKey="activity_worsened_symptoms"
                        choices={[{ v: 'yes', l: t.choiceYes }, { v: 'no', l: t.choiceNo }, { v: 'unsure', l: t.choiceUnsure }]}
                        ctx={ctx} setCtx={setCtx} />

                    {secHead(`🧠 ${t.stressDomain} (${t.contextMore.toLowerCase()})`)}
                    <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: theme.textSoft, marginBottom: 6 }}>{t.emotionalStrainLabel}</div>
                        <textarea
                            value={ctx.emotional_strain_note || ''}
                            onChange={e => setCtx(p => ({ ...p, emotional_strain_note: e.target.value }))}
                            placeholder={t.emotionalStrainPlaceholder}
                            style={{
                                width: '100%', border: `1px solid ${theme.borderSoft}`, borderRadius: 8,
                                padding: '8px 10px', fontSize: 12, resize: 'vertical', minHeight: 56,
                                background: 'rgba(0,0,0,0.3)', color: theme.text, outline: 'none',
                                boxSizing: 'border-box', fontFamily: "'Inter',sans-serif",
                            }}
                        />
                    </div>

                    {secHead(`💧 ${t.hydrationDomain} (${t.contextMore.toLowerCase()})`)}
                    <DocChoiceRow label={t.unusualMealsLabel} fieldKey="large_or_unusual_meals"
                        choices={[{ v: 'yes', l: t.choiceYes }, { v: 'no', l: t.choiceNo }]}
                        ctx={ctx} setCtx={setCtx} />
                    <DocChoiceRow label={t.missedMealsLabel} fieldKey="missed_meals"
                        choices={[{ v: 'yes', l: t.choiceYes }, { v: 'no', l: t.choiceNo }]}
                        ctx={ctx} setCtx={setCtx} />

                    {secHead(`🌡 ${t.environmentDomain}`)}
                    <DocChoiceRow label={t.heatExposureLabel} fieldKey="heat_exposure"
                        choices={[{ v: 'yes', l: t.choiceYes }, { v: 'no', l: t.choiceNo }]}
                        ctx={ctx} setCtx={setCtx} />
                    <DocChoiceRow label={t.coldExposureLabel} fieldKey="cold_exposure"
                        choices={[{ v: 'yes', l: t.choiceYes }, { v: 'no', l: t.choiceNo }]}
                        ctx={ctx} setCtx={setCtx} />
                    <DocChoiceRow label={t.illnessSymptomsLabel} fieldKey="illness_symptoms"
                        choices={[{ v: 'yes', l: t.choiceYes }, { v: 'no', l: t.choiceNo }]}
                        ctx={ctx} setCtx={setCtx} />
                    <DocChoiceRow label={t.travelChangeLabel} fieldKey="travel_or_routine_change"
                        choices={[{ v: 'yes', l: t.choiceYes }, { v: 'no', l: t.choiceNo }]}
                        ctx={ctx} setCtx={setCtx} />
                </div>
            </div>
        </GlassCard>
    );
}

function DocSharedExperience({ exp, setExp }) {
    const { t } = useLang();
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
    const toggle = (key, val) => setExp(p => ({
        ...p,
        [key]: p[key]?.includes(val) ? p[key].filter(x => x !== val) : [...(p[key] || []), val]
    }));

    const chipStyle = (active, col) => ({
        padding: '6px 11px', borderRadius: 20,
        border: `1.5px solid ${active ? col : theme.borderSoft}`,
        background: active ? `${col}18` : 'transparent',
        color: active ? col : theme.textMuted,
        fontSize: 12, fontWeight: active ? 700 : 400, cursor: 'pointer', transition: 'all 0.15s',
    });

    return (
        <GlassCard style={{ padding: 22, marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>
                💙 {t.shareTitle}
            </div>
            <div style={{ color: theme.textMuted, fontSize: 12, marginBottom: 18, lineHeight: 1.6 }}>
                {t.shareSub}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: theme.primary, marginBottom: 10 }}>💚 {t.shareHelpfulLabel}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
                        {helpfulOptions.map(opt => {
                            const active = (exp.helpful || []).includes(opt);
                            return <button key={opt} onClick={() => toggle('helpful', opt)} style={chipStyle(active, theme.primary)}>{active ? '✓ ' : ''}{opt}</button>;
                        })}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: theme.coral, marginBottom: 10 }}>🔴 {t.shareHarderLabel}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
                        {harderOptions.map(opt => {
                            const active = (exp.harder || []).includes(opt);
                            return <button key={opt} onClick={() => toggle('harder', opt)} style={chipStyle(active, theme.coral)}>{active ? '✓ ' : ''}{opt}</button>;
                        })}
                    </div>
                </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: theme.amber, marginBottom: 8 }}>
                ✨ {t.shareWishLabel}
            </div>
            <textarea
                value={exp.wisdom_snippet || ''}
                onChange={e => setExp(p => ({ ...p, wisdom_snippet: e.target.value }))}
                placeholder={t.shareWishPlaceholder}
                maxLength={160}
                style={{
                    width: '100%', border: `1px solid ${theme.borderSoft}`, borderRadius: 8,
                    padding: '8px 10px', fontSize: 12, resize: 'vertical', minHeight: 52,
                    background: 'rgba(0,0,0,0.3)', color: theme.text, outline: 'none',
                    boxSizing: 'border-box', fontFamily: "'Inter',sans-serif",
                }}
            />
            <div style={{ fontSize: 10, color: theme.textMuted, textAlign: 'right', marginTop: 3 }}>{(exp.wisdom_snippet || '').length}/160</div>
        </GlassCard>
    );
}

// ─── Tab 1: Manual sliders ─────────────────────────────────────────────────────
function ManualTab({ patient, config }) {
    const { t } = useLang();
    const [symptoms, setSymptoms] = useState({});
    const [triggers, setTriggers] = useState([]);
    const [notes, setNotes] = useState('');
    const [lifestyleCtx, setLifestyleCtx] = useState({ sleep_duration_hours: 8 });
    const [sharedExp, setSharedExp] = useState({});
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!config) return;
        const init = {};
        config.symptoms.forEach(s => { init[s] = 5.0; });
        setSymptoms(init);
    }, [config]);

    const handleSubmit = async () => {
        setLoading(true); setSaved(null); setError(null);
        try {
            const res = await addEntry({
                patient_id: patient.id,
                symptoms,
                triggers,
                notes: notes || null,
                lifestyle_context: lifestyleCtx,
                shared_experience: sharedExp,
            });
            await computeSignals(patient.id, 7);
            setSaved({ entryId: res.data?.id || '—' });
            setNotes(''); setTriggers([]);
            setLifestyleCtx({ sleep_duration_hours: 8 }); setSharedExp({});
        } catch (e) {
            setError(e.response?.data?.detail || 'Submission failed.');
        } finally { setLoading(false); }
    };

    if (!config) return <div style={{ color: theme.textMuted, padding: 20 }}>Loading…</div>;

    if (saved) return <SavedBanner entryId={saved.entryId} onReset={() => setSaved(null)} />;

    return (
        <div>
            {/* ── Row 1: Symptoms | Triggers + Notes + Save ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Symptoms */}
                <GlassCard style={{ padding: 22 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 18 }}>
                        Symptom Severities (0–10)
                    </div>
                    {config.symptoms.map(sym => (
                        <div key={sym} style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: theme.textSoft }}>{fmtSym(sym)}</span>
                                <span style={{
                                    fontSize: 12, fontWeight: 800, color: sevCol(symptoms[sym] || 5),
                                    background: `${sevCol(symptoms[sym] || 5)}1a`, padding: '2px 8px', borderRadius: 16,
                                }}>
                                    {(symptoms[sym] || 5).toFixed(1)}
                                </span>
                            </div>
                            <input type="range" min={0} max={10} step={0.5}
                                value={symptoms[sym] || 5}
                                onChange={e => setSymptoms(p => ({ ...p, [sym]: parseFloat(e.target.value) }))}
                                style={{ width: '100%', accentColor: sevCol(symptoms[sym] || 5), height: 4 }}
                            />
                        </div>
                    ))}
                </GlassCard>

                {/* Triggers + Notes + Save */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <GlassCard style={{ padding: 22 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14 }}>
                            Active Triggers
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                            {(config.triggers || []).map(tr => {
                                const active = triggers.includes(tr);
                                return (
                                    <button key={tr} onClick={() => setTriggers(prev => active ? prev.filter(x => x !== tr) : [...prev, tr])}
                                        style={{
                                            padding: '6px 11px', borderRadius: 20,
                                            border: `1.5px solid ${active ? theme.teal : theme.borderSoft}`,
                                            background: active ? theme.tealBg : 'transparent',
                                            color: active ? theme.teal : theme.textMuted,
                                            fontSize: 12, fontWeight: active ? 700 : 400, cursor: 'pointer',
                                        }}>
                                        {active ? '✓ ' : ''}{tr.replace(/_/g, ' ')}
                                    </button>
                                );
                            })}
                        </div>
                    </GlassCard>

                    <GlassCard style={{ padding: 22, flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>
                            Notes (optional)
                        </div>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)}
                            placeholder="Any additional observations…"
                            style={{
                                width: '100%', border: `1px solid ${theme.borderSoft}`, borderRadius: 10,
                                padding: '10px 14px', fontSize: 13, resize: 'vertical', minHeight: 80,
                                background: 'rgba(0,0,0,0.3)', color: theme.text, outline: 'none', boxSizing: 'border-box',
                            }}
                        />
                        <button onClick={handleSubmit} disabled={loading} style={{
                            marginTop: 12, width: '100%',
                            background: loading ? 'rgba(95,179,162,0.3)' : `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDeep})`,
                            color: '#fff', border: 'none', borderRadius: 10, padding: '12px 0',
                            fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                        }}>
                            {loading ? '⏳ Saving & computing signals…' : '⚡ Save Entry & Update Signals'}
                        </button>
                        <div style={{
                            marginTop: 10, fontSize: 11, color: theme.textMuted,
                            textAlign: 'center', lineHeight: 1.5,
                            padding: '8px 10px',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: 8,
                            border: `1px solid ${theme.border}22`,
                        }}>
                            🔒 This tool does not provide medical advice. Data is for documentation and signal generation only.
                        </div>
                        {error && <ErrorMsg text={error} />}
                    </GlassCard>
                </div>
            </div>

            {/* ── Row 2: Things That May Have Affected Today ── */}
            <DayContextPanel ctx={lifestyleCtx} setCtx={setLifestyleCtx} />

            {/* ── Row 3: Anonymous Shared Experience ── */}
            <DocSharedExperience exp={sharedExp} setExp={setSharedExp} />
        </div>
    );
}

// ─── Tab 2: PDF Clinical Notes Upload ─────────────────────────────────────────
function PDFTab({ patient, config }) {
    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState(null);         // raw NLP extraction result
    const [editedSymptoms, setEditedSymptoms] = useState({});
    const [triggers, setTriggers] = useState([]);
    const [notes, setNotes] = useState('');
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(null);           // {entryId}
    const inputRef = useRef(null);

    const symList = config?.symptoms || [];
    const confidence = result?.confidence || {};
    const preview = result?.raw_text_preview || '';

    const handleFile = (f) => {
        if (!f) return;
        if (!f.name.toLowerCase().endsWith('.pdf')) { setError('Please upload a PDF file.'); return; }
        setFile(f); setResult(null); setError(null); setEditedSymptoms({});
        setTriggers([]); setNotes(''); setSaved(null);
    };

    // Step 1: Extract only — do NOT save yet
    const runExtraction = async () => {
        if (!file) return;
        setExtracting(true); setError(null); setResult(null);
        try {
            const fd = new FormData();
            fd.append('file', file);
            // Use the preview/extract-only endpoint (same endpoint but we override saved flag via query)
            const res = await uploadSymptomPDF(patient.id, fd);
            setResult(res.data);
            setEditedSymptoms(res.data.extracted_symptoms || {});
        } catch (e) {
            setError(e.response?.data?.detail || 'Extraction failed. Is PyMuPDF installed?');
        } finally { setExtracting(false); }
    };

    // Step 2: Save the reviewed symptoms as a new entry
    const saveEntry = async () => {
        if (Object.keys(editedSymptoms).length === 0) {
            setError('No symptoms to save. Add at least one symptom below.'); return;
        }
        setSaving(true); setError(null);
        try {
            const res = await addEntry({
                patient_id: patient.id,
                symptoms: editedSymptoms,
                triggers,
                notes: notes || (result?.message ? `PDF extract: ${result.message}` : null),
            });
            await computeSignals(patient.id, 7);
            setSaved({ entryId: res.data?.id || result?.entry_id || '—' });
        } catch (e) {
            setError(e.response?.data?.detail || 'Save failed.');
        } finally { setSaving(false); }
    };

    const reset = () => {
        setFile(null); setResult(null); setEditedSymptoms({});
        setTriggers([]); setNotes(''); setSaved(null); setError(null);
    };

    if (saved) return <SavedBanner entryId={saved.entryId} onReset={reset} />;

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* LEFT — upload + text preview */}
            <div>
                <div
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
                    onClick={() => inputRef.current?.click()}
                    style={{
                        border: `2px dashed ${dragging ? theme.teal : theme.border}`,
                        borderRadius: 16, padding: '40px 24px', textAlign: 'center',
                        cursor: 'pointer', marginBottom: 16,
                        background: dragging ? 'rgba(95,179,162,0.08)' : 'transparent',
                        transition: 'all 0.2s',
                    }}
                >
                    <input ref={inputRef} type="file" accept=".pdf" style={{ display: 'none' }}
                        onChange={e => handleFile(e.target.files[0])}
                    />
                    <div style={{ fontSize: 40, marginBottom: 10 }}>📄</div>
                    <div style={{ color: theme.text, fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                        {file ? file.name : 'Drop clinical notes PDF here'}
                    </div>
                    <div style={{ color: theme.textMuted, fontSize: 13 }}>
                        {file ? `${(file.size / 1024).toFixed(1)} KB · click to change` : 'or click to browse · PDF only'}
                    </div>
                </div>

                {file && !result && (
                    <button onClick={runExtraction} disabled={extracting} style={{
                        width: '100%', padding: '13px',
                        background: `linear-gradient(135deg, #6366f1, #8b5cf6)`,
                        border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 700,
                        cursor: extracting ? 'not-allowed' : 'pointer', opacity: extracting ? 0.7 : 1,
                    }}>
                        {extracting ? '🔍 Extracting symptoms…' : '🧠 Run NLP Extraction'}
                    </button>
                )}

                {error && <ErrorMsg text={error} />}

                {preview && (
                    <GlassCard style={{ padding: 16, marginTop: 16 }}>
                        <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>
                            PDF Text Preview
                        </div>
                        <div style={{ color: theme.textSoft, fontSize: 12, lineHeight: 1.7, maxHeight: 190, overflow: 'auto' }}>
                            {preview}
                        </div>
                    </GlassCard>
                )}

                {/* Triggers + notes appear after extraction */}
                {result && (
                    <>
                        <GlassCard style={{ padding: 18, marginTop: 16 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
                                Active Triggers (optional)
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                                {(config?.triggers || []).map(tr => {
                                    const active = triggers.includes(tr);
                                    return (
                                        <button key={tr} onClick={() => setTriggers(prev => active ? prev.filter(x => x !== tr) : [...prev, tr])}
                                            style={{
                                                padding: '5px 10px', borderRadius: 18,
                                                border: `1.5px solid ${active ? theme.teal : theme.borderSoft}`,
                                                background: active ? theme.tealBg : 'transparent',
                                                color: active ? theme.teal : theme.textMuted,
                                                fontSize: 12, fontWeight: active ? 700 : 400, cursor: 'pointer',
                                            }}>
                                            {active ? '✓ ' : ''}{tr.replace(/_/g, ' ')}
                                        </button>
                                    );
                                })}
                            </div>
                        </GlassCard>

                        <GlassCard style={{ padding: 18, marginTop: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
                                Additional Notes
                            </div>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)}
                                placeholder="Clinician comments, adjustments, context…"
                                style={{
                                    width: '100%', border: `1px solid ${theme.borderSoft}`, borderRadius: 10,
                                    padding: '9px 12px', fontSize: 13, resize: 'vertical', minHeight: 70,
                                    background: 'rgba(0,0,0,0.3)', color: theme.text, outline: 'none', boxSizing: 'border-box',
                                }}
                            />
                        </GlassCard>
                    </>
                )}
            </div>

            {/* RIGHT — editable extraction results + SAVE button */}
            <div>
                {result ? (
                    <GlassCard style={{ padding: 22 }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                                Extracted Symptoms — Review &amp; Edit
                            </div>
                            <span style={{
                                fontSize: 11, padding: '3px 9px', borderRadius: 8,
                                background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', fontWeight: 700,
                            }}>
                                {Object.keys(editedSymptoms).length}/{symList.length} symptoms
                            </span>
                        </div>
                        <div style={{ color: theme.textMuted, fontSize: 12, marginBottom: 14 }}>{result.message}</div>

                        {Object.keys(editedSymptoms).length === 0 && (
                            <div style={{ color: theme.textMuted, fontSize: 13, padding: '12px 0' }}>
                                No symptoms extracted automatically. Use the "+ Add" buttons below to manually set values.
                            </div>
                        )}

                        {/* Extracted + editable sliders */}
                        {Object.entries(editedSymptoms).map(([sym, val]) => {
                            const conf = confidence[sym] || 0;
                            return (
                                <div key={sym} style={{ marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${theme.border}22` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: theme.textSoft }}>{fmtSym(sym)}</span>
                                        {conf > 0 && (
                                            <span style={{
                                                fontSize: 11, color: CONFIDENCE_COL(conf),
                                                background: `${CONFIDENCE_COL(conf)}22`,
                                                border: `1px solid ${CONFIDENCE_COL(conf)}44`,
                                                borderRadius: 8, padding: '2px 7px',
                                            }}>
                                                {conf}% confidence
                                            </span>
                                        )}
                                        <span style={{ fontSize: 13, fontWeight: 900, color: sevCol(val), minWidth: 30, textAlign: 'right' }}>
                                            {val.toFixed(1)}
                                        </span>
                                        <button onClick={() => setEditedSymptoms(p => { const n = { ...p }; delete n[sym]; return n; })}
                                            title="Remove"
                                            style={{ background: 'none', border: 'none', color: theme.coral, cursor: 'pointer', fontSize: 14, padding: '0 2px' }}>
                                            ×
                                        </button>
                                    </div>
                                    <input type="range" min={0} max={10} step={0.5} value={val}
                                        onChange={e => setEditedSymptoms(p => ({ ...p, [sym]: parseFloat(e.target.value) }))}
                                        style={{ width: '100%', accentColor: sevCol(val), height: 4 }}
                                    />
                                </div>
                            );
                        })}

                        {/* Add missing symptoms */}
                        {symList.filter(s => !(s in editedSymptoms)).length > 0 && (
                            <div style={{ marginTop: 4, paddingTop: 12, borderTop: `1px solid ${theme.border}` }}>
                                <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 8 }}>
                                    + Add symptoms not extracted:
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {symList.filter(s => !(s in editedSymptoms)).map(sym => (
                                        <button key={sym} onClick={() => setEditedSymptoms(p => ({ ...p, [sym]: 5.0 }))}
                                            style={{
                                                padding: '4px 10px', borderRadius: 12,
                                                border: `1px solid ${theme.borderSoft}`,
                                                background: 'transparent', color: theme.textMuted, fontSize: 11, cursor: 'pointer',
                                                transition: 'all 0.15s',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = theme.teal; e.currentTarget.style.color = theme.teal; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = theme.borderSoft; e.currentTarget.style.color = theme.textMuted; }}
                                        >
                                            + {sym.replace(/_/g, ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── THE SAVE BUTTON ── */}
                        <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${theme.border}` }}>
                            <button onClick={saveEntry} disabled={saving || Object.keys(editedSymptoms).length === 0}
                                style={{
                                    width: '100%', padding: '14px',
                                    background: saving ? 'rgba(95,179,162,0.3)' : `linear-gradient(135deg, ${theme.teal}, ${theme.primary})`,
                                    border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700,
                                    cursor: (saving || Object.keys(editedSymptoms).length === 0) ? 'not-allowed' : 'pointer',
                                    opacity: Object.keys(editedSymptoms).length === 0 ? 0.5 : 1,
                                    transition: 'all 0.2s',
                                }}>
                                {saving ? '⏳ Saving & recomputing signals…' : '💾 Save Reviewed Entry to Database'}
                            </button>
                            <div style={{ marginTop: 8, fontSize: 11, color: theme.textMuted, textAlign: 'center' }}>
                                Edit sliders above, then click Save — signals &amp; Clinician View will update automatically.
                            </div>
                            {error && <ErrorMsg text={error} />}
                        </div>
                    </GlassCard>
                ) : (
                    <GlassCard style={{ padding: 32, textAlign: 'center' }}>
                        <div style={{ fontSize: 32, marginBottom: 10 }}>🧠</div>
                        <div style={{ color: theme.textMuted, fontSize: 14, marginBottom: 14 }}>
                            Upload a PDF clinical note to automatically extract symptom severities using NLP.
                        </div>
                        <div style={{
                            padding: '14px 18px', background: 'rgba(99,102,241,0.08)',
                            border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12,
                            color: theme.textSoft, fontSize: 12, lineHeight: 1.9, textAlign: 'left',
                        }}>
                            <b style={{ color: '#a5b4fc' }}>Workflow:</b><br />
                            1️⃣ Upload PDF → 2️⃣ NLP extracts symptoms<br />
                            3️⃣ Review &amp; adjust sliders → 4️⃣ Click <b>Save Entry</b><br />
                            5️⃣ Signals recomputed → Clinician View updated
                        </div>
                    </GlassCard>
                )}
            </div>
        </div>
    );
}

// ─── Tab 3: CSV / Excel Upload ────────────────────────────────────────────────
function CSVTab({ patient }) {
    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [computingSignals, setComputingSignals] = useState(false);
    const [result, setResult] = useState(null);
    const [signalsDone, setSignalsDone] = useState(false);
    const [error, setError] = useState(null);
    const inputRef = useRef(null);

    const parseCSVPreview = (text) => {
        const lines = text.trim().split('\n').slice(0, 8);
        const headers = lines[0].split(',').map(h => h.trim());
        const rows = lines.slice(1).map(l => l.split(',').map(c => c.trim()));
        return { headers, rows };
    };

    const handleFile = async (f) => {
        if (!f) return;
        const name = f.name.toLowerCase();
        if (!name.endsWith('.csv') && !name.endsWith('.xlsx') && !name.endsWith('.xls')) {
            setError('Please upload a CSV or Excel file.'); return;
        }
        setFile(f); setResult(null); setError(null); setSignalsDone(false);
        if (name.endsWith('.csv')) {
            const text = await f.text();
            setPreview(parseCSVPreview(text));
        } else {
            setPreview({ headers: ['date', 'symptom_name', 'value', '…'], rows: [['(Excel — preview n/a)'], ['Upload to begin import']] });
        }
    };

    const upload = async () => {
        if (!file) return;
        setLoading(true); setError(null); setResult(null); setSignalsDone(false);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await uploadSymptomCSV(patient.id, fd);
            setResult(res.data);
            // Auto recompute signals after import
            setComputingSignals(true);
            await computeSignals(patient.id, 7);
            setSignalsDone(true);
        } catch (e) {
            setError(e.response?.data?.detail || 'Import failed.');
        } finally { setLoading(false); setComputingSignals(false); }
    };

    const reset = () => {
        setFile(null); setPreview(null); setResult(null);
        setSignalsDone(false); setError(null);
    };

    if (result && signalsDone) return (
        <div>
            <SavedBanner importedCount={result.imported} onReset={reset} />
            {/* Show skipped/errors below */}
            {(result.skipped > 0 || result.errors?.length > 0) && (
                <GlassCard style={{ padding: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: theme.amber, marginBottom: 10 }}>
                        ⚠ Skipped rows: {result.skipped}
                    </div>
                    {result.errors?.slice(0, 8).map((e, i) => (
                        <div key={i} style={{ fontSize: 12, color: theme.coral, marginBottom: 4 }}>• {e}</div>
                    ))}
                    {result.errors?.length > 8 && (
                        <div style={{ fontSize: 11, color: theme.textMuted }}>…and {result.errors.length - 8} more</div>
                    )}
                </GlassCard>
            )}
        </div>
    );

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
                {/* Drop zone */}
                <div
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
                    onClick={() => inputRef.current?.click()}
                    style={{
                        border: `2px dashed ${dragging ? theme.teal : theme.border}`,
                        borderRadius: 16, padding: '40px 24px', textAlign: 'center',
                        cursor: 'pointer', marginBottom: 16,
                        background: dragging ? 'rgba(95,179,162,0.08)' : 'transparent',
                        transition: 'all 0.2s',
                    }}
                >
                    <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
                        onChange={e => handleFile(e.target.files[0])}
                    />
                    <div style={{ fontSize: 40, marginBottom: 10 }}>📊</div>
                    <div style={{ color: theme.text, fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                        {file ? file.name : 'Drop CSV / Excel here'}
                    </div>
                    <div style={{ color: theme.textMuted, fontSize: 13 }}>
                        {file ? `${(file.size / 1024).toFixed(1)} KB · click to change` : 'or click to browse · CSV, XLSX, XLS'}
                    </div>
                </div>

                {/* Format guide */}
                <GlassCard style={{ padding: 18, marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted, marginBottom: 10 }}>
                        Supported formats:
                    </div>
                    <div style={{ fontSize: 12, color: theme.textSoft, lineHeight: 1.9 }}>
                        <b style={{ color: theme.teal }}>Long format (one row = one symptom):</b><br />
                        <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>
                            date, symptom_name, value, triggers, notes
                        </code>
                        <br /><br />
                        <b style={{ color: theme.amber }}>Wide format (one row = one day):</b><br />
                        <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>
                            date, breathlessness, fatigue, …, triggers, notes
                        </code>
                    </div>
                </GlassCard>

                {/* Import button */}
                {file && !result && (
                    <button onClick={upload} disabled={loading || computingSignals} style={{
                        width: '100%', padding: '14px',
                        background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDeep})`,
                        border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 700,
                        cursor: (loading || computingSignals) ? 'not-allowed' : 'pointer',
                        opacity: (loading || computingSignals) ? 0.7 : 1,
                    }}>
                        {loading ? '⏳ Importing entries…' : computingSignals ? '📊 Recomputing signals…' : '📥 Import & Save All Rows'}
                    </button>
                )}

                {/* In-progress signals indicator */}
                {result && computingSignals && (
                    <GlassCard style={{ padding: 16, marginTop: 12, textAlign: 'center' }}>
                        <div style={{ color: theme.teal, fontSize: 13, fontWeight: 600 }}>
                            ✓ {result.imported} entries imported — recomputing signals…
                        </div>
                    </GlassCard>
                )}

                {error && <ErrorMsg text={error} />}
            </div>

            {/* Preview table */}
            <div>
                {preview ? (
                    <GlassCard style={{ padding: 18, overflowX: 'auto' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 }}>
                            File Preview (first 7 rows)
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                                <tr>
                                    {preview.headers.map((h, i) => (
                                        <th key={i} style={{ padding: '7px 10px', textAlign: 'left', color: theme.teal, borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap', fontWeight: 700 }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {preview.rows.map((row, ri) => (
                                    <tr key={ri} style={{ background: ri % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                                        {row.map((cell, ci) => (
                                            <td key={ci} style={{ padding: '6px 10px', color: theme.textSoft, borderBottom: `1px solid ${theme.border}22`, whiteSpace: 'nowrap' }}>
                                                {cell}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </GlassCard>
                ) : (
                    <GlassCard style={{ padding: 32, textAlign: 'center' }}>
                        <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                        <div style={{ color: theme.textMuted, fontSize: 14 }}>
                            Upload a file to preview rows and bulk-import historical symptom data.
                        </div>
                        <div style={{
                            marginTop: 16, padding: '14px 18px', background: 'rgba(95,179,162,0.06)',
                            border: '1px solid rgba(95,179,162,0.18)', borderRadius: 12,
                            color: theme.textSoft, fontSize: 12, lineHeight: 1.9, textAlign: 'left',
                        }}>
                            <b style={{ color: theme.teal }}>Workflow:</b><br />
                            1️⃣ Drop your CSV / Excel file<br />
                            2️⃣ Preview rows on the right<br />
                            3️⃣ Click <b>Import &amp; Save All Rows</b><br />
                            4️⃣ Signals recomputed automatically<br />
                            5️⃣ Clinician View reflects new data ✅
                        </div>
                    </GlassCard>
                )}
            </div>
        </div>
    );
}

// ─── Main DoctorInput page ─────────────────────────────────────────────────────
export default function DoctorInput({ patient }) {
    const [tab, setTab] = useState('manual');
    const [config, setConfig] = useState(null);

    useEffect(() => {
        if (!patient?.disease) return;
        getDiseaseConfig(patient.disease).then(r => setConfig(r.data)).catch(() => { });
    }, [patient?.disease]);

    return (
        <div style={{ fontFamily: "'Inter', sans-serif", color: theme.text }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>👨‍⚕️ Doctor Input</div>
                <div style={{ color: theme.textMuted, fontSize: 14 }}>
                    Patient: <b style={{ color: theme.teal }}>{patient?.id}</b> ·
                    Disease: <b style={{ color: '#fcd34d' }}>{patient?.disease}</b>
                </div>
            </div>

            {/* Tab bar */}
            <GlassCard style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', borderBottom: `1px solid ${theme.border}` }}>
                    <TabBtn active={tab === 'manual'} onClick={() => setTab('manual')} icon="✏️" label="Manual Entry" />
                    <TabBtn active={tab === 'pdf'} onClick={() => setTab('pdf')} icon="📄" label="PDF / NLP Extract" />
                    <TabBtn active={tab === 'csv'} onClick={() => setTab('csv')} icon="📊" label="Spreadsheet Upload" />
                </div>
            </GlassCard>

            {/* Tab contents */}
            <div>
                {tab === 'manual' && <ManualTab patient={patient} config={config} />}
                {tab === 'pdf' && <PDFTab patient={patient} config={config} />}
                {tab === 'csv' && <CSVTab patient={patient} />}
            </div>
        </div>
    );
}
