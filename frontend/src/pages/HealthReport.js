// HealthReport.js — Structured Patient Health Report with Disease Tests + Gemini Summary
import React, { useEffect, useState, useCallback } from 'react';
import { useLang } from '../i18n/LanguageContext';
import { getHealthReport } from '../api';
import theme from '../theme';

const T = theme; // convenience alias

// ─── Priority config ──────────────────────────────────────────────────────────
const PRIORITY_STYLE = {
    HIGH: { bg: 'rgba(239,68,68,0.15)', border: '#ef4444', color: '#fca5a5', dot: '#ef4444' },
    WATCH: { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', color: '#fcd34d', dot: '#f59e0b' },
    ROUTINE: { bg: 'rgba(20,184,166,0.12)', border: '#14b8a6', color: '#5eead4', dot: '#14b8a6' },
};
const RISK_COLOUR = {
    LOW: { bg: 'rgba(20,184,166,0.15)', border: '#14b8a6', text: '#5eead4' },
    MODERATE: { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', text: '#fcd34d' },
    HIGH: { bg: 'rgba(239,68,68,0.15)', border: '#ef4444', text: '#fca5a5' },
    CRITICAL: { bg: 'rgba(239,68,68,0.25)', border: '#ff2020', text: '#ff8080' },
    INSUFFICIENT_DATA: { bg: 'rgba(100,116,139,0.15)', border: '#64748b', text: '#94a3b8' },
};

// ─── HoverCard ───────────────────────────────────────────────────────────────
function HoverCard({ children, style = {} }) {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                background: 'rgba(15,23,42,0.65)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                border: `1px solid ${hovered ? 'rgba(20,184,166,0.55)' : 'rgba(20,184,166,0.18)'}`,
                borderRadius: 16,
                boxShadow: hovered
                    ? '0 12px 40px rgba(20,184,166,0.2), 0 0 0 1px rgba(20,184,166,0.15)'
                    : '0 4px 20px rgba(0,0,0,0.4)',
                transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
                transition: 'all 0.3s ease',
                ...style,
            }}
        >
            {children}
        </div>
    );
}

// ─── Section header ──────────────────────────────────────────────────────────
function SectionHeader({ icon, title, badge }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.teal }}>
                {title}
            </span>
            {badge && (
                <span style={{
                    marginLeft: 'auto',
                    background: 'rgba(20,184,166,0.15)',
                    border: '1px solid rgba(20,184,166,0.3)',
                    borderRadius: 20,
                    padding: '2px 10px',
                    fontSize: 12,
                    color: T.teal,
                }}>
                    {badge}
                </span>
            )}
        </div>
    );
}

// ─── Test item ───────────────────────────────────────────────────────────────
function TestItem({ item }) {
    const [open, setOpen] = useState(false);
    const ps = PRIORITY_STYLE[item.priority] || PRIORITY_STYLE.ROUTINE;
    return (
        <div
            onClick={() => setOpen(o => !o)}
            style={{
                background: ps.bg,
                border: `1px solid ${ps.border}33`,
                borderLeft: `3px solid ${ps.border}`,
                borderRadius: 10,
                padding: '10px 14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: 8,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: ps.dot, flexShrink: 0 }} />
                <span style={{ color: '#e2e8f0', fontSize: 14, flex: 1, fontWeight: 500 }}>{item.name}</span>
                <span style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                    color: ps.color, background: `${ps.border}22`,
                    border: `1px solid ${ps.border}55`, borderRadius: 6, padding: '2px 7px',
                }}>
                    {item.priority}
                </span>
                <span style={{ color: '#64748b', fontSize: 13, marginLeft: 4 }}>{open ? '▲' : '▼'}</span>
            </div>
            {open && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${ps.border}22`, color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>
                    {item.why}
                </div>
            )}
        </div>
    );
}

// ─── Tests panel ─────────────────────────────────────────────────────────────
function TestsPanel({ tests }) {
    const categories = [
        { key: 'labs', icon: '🧪', label: 'Lab Tests' },
        { key: 'imaging', icon: '🫁', label: 'Imaging' },
        { key: 'specialist', icon: '👨‍⚕️', label: 'Specialist Referrals' },
        { key: 'monitoring', icon: '📈', label: 'Monitoring Tools' },
    ];

    const total = categories.reduce((s, c) => s + (tests[c.key]?.length || 0), 0);

    return (
        <HoverCard style={{ padding: 24, marginBottom: 24 }}>
            <SectionHeader icon="🔬" title="Recommended Tests & Investigations" badge={`${total} items`} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 20 }}>
                {categories.map(cat => {
                    const items = tests[cat.key];
                    if (!items || items.length === 0) return null;
                    return (
                        <div key={cat.key}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
                                color: '#94a3b8', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                            }}>
                                <span>{cat.icon}</span> {cat.label}
                                <span style={{ marginLeft: 'auto', background: 'rgba(100,116,139,0.2)', borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>
                                    {items.length}
                                </span>
                            </div>
                            {items.map((item, i) => <TestItem key={i} item={item} />)}
                        </div>
                    );
                })}
            </div>
            <div style={{
                marginTop: 16, padding: '10px 14px',
                background: 'rgba(100,116,139,0.1)', borderRadius: 10,
                color: '#64748b', fontSize: 12, lineHeight: 1.6,
            }}>
                <b style={{ color: '#94a3b8' }}>Legend:</b>{' '}
                <span style={{ color: '#fca5a5' }}>● HIGH</span> — Priority for your condition &nbsp;
                <span style={{ color: '#fcd34d' }}>● WATCH</span> — Recommended if symptoms change &nbsp;
                <span style={{ color: '#5eead4' }}>● ROUTINE</span> — Standard periodic monitoring
            </div>
        </HoverCard>
    );
}

// ─── Functional Impact Bar ───────────────────────────────────────────────────
function ImpactBar({ label, value, colour }) {
    return (
        <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ color: '#94a3b8', fontSize: 13 }}>{label}</span>
                <span style={{ color: colour || T.teal, fontSize: 13, fontWeight: 700 }}>{value}%</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, height: 7, overflow: 'hidden' }}>
                <div style={{
                    height: '100%', borderRadius: 8,
                    background: colour || `linear-gradient(90deg, ${T.teal}, #6366f1)`,
                    width: `${Math.min(value, 100)}%`,
                    transition: 'width 1s ease',
                }} />
            </div>
        </div>
    );
}

// ─── Risk Badge ───────────────────────────────────────────────────────────────
function RiskBadge({ risk }) {
    const rc = RISK_COLOUR[risk] || RISK_COLOUR.INSUFFICIENT_DATA;
    return (
        <span style={{
            background: rc.bg, border: `1px solid ${rc.border}`,
            color: rc.text, borderRadius: 8, padding: '4px 14px',
            fontSize: 13, fontWeight: 700, letterSpacing: '0.1em',
        }}>
            {risk}
        </span>
    );
}

// ─── AI Summary Panel ────────────────────────────────────────────────────────
function SummaryPanel({ report }) {
    const paragraphs = (report.patient_summary || '').split('\n\n').filter(Boolean);
    const note = paragraphs[paragraphs.length - 1]?.startsWith('Note:')
        ? paragraphs.pop() : null;

    return (
        <HoverCard style={{ padding: 24, marginBottom: 24 }}>
            <SectionHeader
                icon={report.is_ai_generated ? '🤖' : '📋'}
                title={report.is_ai_generated ? 'AI Health Summary (Gemini)' : 'Health Summary'}
                badge={report.is_ai_generated ? 'Gemini AI' : 'Structured'}
            />
            <div style={{ color: '#cbd5e1', fontSize: 14.5, lineHeight: 1.8 }}>
                {paragraphs.map((p, i) => (
                    <p key={i} style={{ marginBottom: 14 }}>{p}</p>
                ))}
                {note && (
                    <div style={{
                        marginTop: 16, padding: '10px 14px',
                        background: 'rgba(100,116,139,0.12)',
                        border: '1px solid rgba(100,116,139,0.25)',
                        borderRadius: 10, color: '#64748b', fontSize: 12,
                    }}>
                        {note}
                    </div>
                )}
            </div>
        </HoverCard>
    );
}

// ─── Overview panel ──────────────────────────────────────────────────────────
function OverviewPanel({ report }) {
    const fi = report.functional_impact || {};
    const rc = RISK_COLOUR[report.risk_category] || RISK_COLOUR.INSUFFICIENT_DATA;

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            {/* Risk + Deviations */}
            <HoverCard style={{ padding: 22 }}>
                <SectionHeader icon="📊" title="Signal Overview" />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                    <span style={{ color: '#94a3b8', fontSize: 14 }}>Risk Category</span>
                    <RiskBadge risk={report.risk_category} />
                </div>
                {report.top_deviations && report.top_deviations.length > 0 ? (
                    <div>
                        <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Top Signal Deviations
                        </div>
                        {report.top_deviations.map((d, i) => (
                            <div key={i} style={{
                                padding: '7px 12px', marginBottom: 6,
                                background: `${rc.bg}`,
                                border: `1px solid ${rc.border}33`,
                                borderRadius: 8, color: rc.text, fontSize: 13,
                                fontFamily: 'monospace',
                            }}>
                                {d}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ color: '#64748b', fontSize: 13 }}>
                        No significant signal deviations in this period.
                    </div>
                )}
                {report.forecast_trend && (
                    <div style={{
                        marginTop: 14, padding: '8px 12px',
                        background: 'rgba(99,102,241,0.1)',
                        border: '1px solid rgba(99,102,241,0.2)',
                        borderRadius: 8, color: '#a5b4fc', fontSize: 13,
                    }}>
                        📅 Forecast: {report.forecast_trend.charAt(0).toUpperCase() + report.forecast_trend.slice(1)}
                    </div>
                )}
            </HoverCard>

            {/* Functional Impact */}
            <HoverCard style={{ padding: 22 }}>
                <SectionHeader icon="🏃" title="Functional Impact" badge={`${fi.composite_pct || 0}% overall`} />
                <ImpactBar label="Mobility" value={fi.mobility_pct || 0} colour="#ef4444" />
                <ImpactBar label="Sleep" value={fi.sleep_pct || 0} colour="#6366f1" />
                <ImpactBar label="Cognitive" value={fi.cognitive_pct || 0} colour="#f59e0b" />
                <div style={{ marginTop: 16 }}>
                    <div style={{ color: '#64748b', fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Composite Score
                    </div>
                    <div style={{
                        background: 'rgba(255,255,255,0.04)', borderRadius: 12, height: 14, overflow: 'hidden',
                    }}>
                        <div style={{
                            height: '100%', borderRadius: 12,
                            background: 'linear-gradient(90deg,#14b8a6,#6366f1,#f59e0b)',
                            width: `${Math.min(fi.composite_pct || 0, 100)}%`,
                            transition: 'width 1.2s ease',
                        }} />
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 5, textAlign: 'right' }}>
                        {fi.composite_pct || 0}% impact on daily function
                    </div>
                </div>
                {report.red_flags && report.red_flags.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                        <div style={{ color: '#fca5a5', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>⚠ Red Flags</div>
                        {report.red_flags.map((rf, i) => (
                            <div key={i} style={{
                                padding: '5px 10px', marginBottom: 4,
                                background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.25)',
                                borderRadius: 6, color: '#fca5a5', fontSize: 13,
                            }}>
                                {rf}
                            </div>
                        ))}
                    </div>
                )}
            </HoverCard>
        </div>
    );
}

// ─── Print Button ─────────────────────────────────────────────────────────────
function PrintButton() {
    return (
        <button
            onClick={() => window.print()}
            style={{
                background: 'rgba(20,184,166,0.15)',
                border: '1px solid rgba(20,184,166,0.4)',
                borderRadius: 10, padding: '8px 18px',
                color: T.teal, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
                transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(20,184,166,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(20,184,166,0.15)'}
        >
            🖨 Print / Export
        </button>
    );
}

// ─── Skeleton Loader ─────────────────────────────────────────────────────────
function Skeleton() {
    return (
        <div style={{ padding: 32 }}>
            {[240, 180, 380, 300].map((h, i) => (
                <div key={i} style={{
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 16, height: h, marginBottom: 20,
                    animation: 'pulse 1.5s ease-in-out infinite',
                }} />
            ))}
            <style>{`@keyframes pulse{0%,100%{opacity:0.5}50%{opacity:1}}`}</style>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function HealthReport({ patient }) {
    const { t } = useLang();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [windowDays, setWindowDays] = useState(7);

    const fetchReport = useCallback(async () => {
        if (!patient?.id) return;
        setLoading(true);
        setError(null);
        try {
            const res = await getHealthReport(patient.id, windowDays);
            setReport(res.data);
        } catch (e) {
            setError(e.response?.data?.detail || 'Failed to load health report. Ensure signals have been computed first.');
        } finally {
            setLoading(false);
        }
    }, [patient?.id, windowDays]);

    useEffect(() => { fetchReport(); }, [fetchReport]);

    // ── Ambient orb style ──────────────────────────────────────────────────────
    const pageStyle = {
        minHeight: '100vh',
        padding: '28px 32px',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        color: '#e2e8f0',
        position: 'relative',
    };

    return (
        <div style={pageStyle}>
            {/* Page Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
                <div>
                    <h1 style={{ fontSize: 26, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>
                        🏥 Health Report
                    </h1>
                    <div style={{ color: '#64748b', fontSize: 14 }}>
                        {patient?.disease
                            ? <>Patient: <b style={{ color: T.teal }}>{patient.id}</b> · Disease: <b style={{ color: '#fcd34d' }}>{patient.disease}</b></>
                            : 'Select a patient to view their health report'}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {/* Window selector */}
                    <select
                        value={windowDays}
                        onChange={e => setWindowDays(Number(e.target.value))}
                        style={{
                            background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(20,184,166,0.3)',
                            borderRadius: 8, color: '#e2e8f0', padding: '7px 12px', fontSize: 13, cursor: 'pointer',
                        }}
                    >
                        <option value={7}>Last 7 days</option>
                        <option value={14}>Last 14 days</option>
                        <option value={30}>Last 30 days</option>
                    </select>
                    <button
                        onClick={fetchReport}
                        disabled={loading}
                        style={{
                            background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(20,184,166,0.3)',
                            borderRadius: 8, color: T.teal, padding: '7px 14px', fontSize: 13,
                            cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                            transition: 'all 0.2s',
                        }}
                    >
                        {loading ? '⏳ Generating…' : '↺ Refresh'}
                    </button>
                    <PrintButton />
                </div>
            </div>

            {/* States */}
            {loading && <Skeleton />}

            {error && (
                <HoverCard style={{ padding: 24, borderColor: 'rgba(239,68,68,0.4)' }}>
                    <div style={{ color: '#fca5a5', fontSize: 15, fontWeight: 600, marginBottom: 8 }}>⚠ Unable to load report</div>
                    <div style={{ color: '#94a3b8', fontSize: 14 }}>{error}</div>
                    <div style={{ marginTop: 12, color: '#64748b', fontSize: 13 }}>
                        Tip: Click <b>Compute Signals</b> on the Dashboard first, then refresh this report.
                    </div>
                </HoverCard>
            )}

            {!loading && !error && report && (
                <div id="printable-report">
                    {/* Meta banner */}
                    <HoverCard style={{ padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                        <div style={{ color: '#64748b', fontSize: 13 }}>
                            Disease: <b style={{ color: '#fcd34d' }}>{report.disease_name}</b>
                        </div>
                        <div style={{ color: '#64748b', fontSize: 13 }}>
                            Period: <b style={{ color: '#94a3b8' }}>Last {report.period_days} days</b>
                        </div>
                        <div style={{ color: '#64748b', fontSize: 13 }}>
                            Generated: <b style={{ color: '#94a3b8' }}>
                                {report.generated_at ? new Date(report.generated_at).toLocaleString() : '—'}
                            </b>
                        </div>
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <RiskBadge risk={report.risk_category} />
                            {report.is_ai_generated && (
                                <span style={{
                                    background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                                    borderRadius: 8, padding: '2px 10px', fontSize: 11, color: '#a5b4fc',
                                }}>
                                    ✦ Gemini AI
                                </span>
                            )}
                        </div>
                    </HoverCard>

                    {/* Overview: risk + functional impact */}
                    <OverviewPanel report={report} />

                    {/* AI / structured summary */}
                    <SummaryPanel report={report} />

                    {/* Recommended tests */}
                    {report.recommended_tests && Object.keys(report.recommended_tests).length > 0 && (
                        <TestsPanel tests={report.recommended_tests} />
                    )}

                    {/* Disclaimer */}
                    <div style={{
                        padding: '14px 18px', marginTop: 8,
                        background: 'rgba(100,116,139,0.08)',
                        border: '1px solid rgba(100,116,139,0.15)',
                        borderRadius: 12, color: '#475569', fontSize: 12, lineHeight: 1.7,
                    }}>
                        🛡 <b style={{ color: '#64748b' }}>Disclaimer:</b> {report.disclaimer}
                    </div>
                </div>
            )}

            {!loading && !error && !report && patient?.id && (
                <HoverCard style={{ padding: 40, textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🏥</div>
                    <div style={{ color: '#94a3b8', fontSize: 16 }}>No report data available yet.</div>
                    <div style={{ color: '#64748b', fontSize: 14, marginTop: 8 }}>
                        Go to the Dashboard and click <b style={{ color: T.teal }}>Compute Signals</b> first.
                    </div>
                </HoverCard>
            )}

            {/* Print styles */}
            <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          #printable-report { filter: none !important; }
          button, select { display: none !important; }
        }
      `}</style>
        </div>
    );
}
