// LogSymptoms.js — Role-toggle wrapper: Doctor mode vs Patient (Gesture) mode
import React, { useState } from 'react';
import DoctorInput from './DoctorInput';
import GestureInput from './GestureInput';
import theme from '../theme';

const ROLES = [
    {
        id: 'patient',
        icon: '🧑',
        title: 'Patient Mode',
        subtitle: 'Gesture-based — tap, swipe, or dwell to log. No typing needed.',
        gradient: 'linear-gradient(135deg, rgba(95,179,162,0.2), rgba(99,102,241,0.12))',
        border: 'rgba(95,179,162,0.45)',
        glow: 'rgba(95,179,162,0.15)',
    },
    {
        id: 'doctor',
        icon: '👨‍⚕️',
        title: 'Doctor / Clinician',
        subtitle: 'Manual sliders, PDF clinical notes (NLP extract), or CSV upload.',
        gradient: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.12))',
        border: 'rgba(99,102,241,0.45)',
        glow: 'rgba(99,102,241,0.15)',
    },
];

export default function LogSymptoms({ patient }) {
    const [role, setRole] = useState(null);

    if (!patient?.id) {
        return (
            <div style={{ padding: 60, textAlign: 'center', color: theme.textMuted, fontFamily: "'Inter', sans-serif" }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>👥</div>
                <div style={{ fontSize: 16 }}>Select a patient first using the selector above.</div>
            </div>
        );
    }

    // ── Role selection screen ──────────────────────────────────────────────────
    if (!role) return (
        <div style={{ fontFamily: "'Inter', sans-serif", color: theme.text, maxWidth: 640, margin: '0 auto', padding: '32px 0' }}>
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
                <h1 style={{ fontSize: 26, fontWeight: 900, color: theme.text, marginBottom: 6 }}>
                    📝 Log Symptoms
                </h1>
                <div style={{ color: theme.textMuted, fontSize: 15 }}>
                    Who is entering today's data?
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {ROLES.map(r => (
                    <button
                        key={r.id}
                        onClick={() => setRole(r.id)}
                        style={{
                            background: r.gradient,
                            border: `1.5px solid ${r.border}`,
                            borderRadius: 20,
                            padding: '32px 28px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            boxShadow: `0 12px 40px ${r.glow}`,
                            transition: 'all 0.25s',
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.boxShadow = `0 20px 50px ${r.glow}`;
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = `0 12px 40px ${r.glow}`;
                        }}
                    >
                        <div style={{ fontSize: 44, marginBottom: 14 }}>{r.icon}</div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: theme.text, marginBottom: 8 }}>{r.title}</div>
                        <div style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.7 }}>{r.subtitle}</div>
                        <div style={{
                            marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 6,
                            fontSize: 13, fontWeight: 700,
                            color: r.id === 'patient' ? theme.teal : '#a5b4fc',
                        }}>
                            Select →
                        </div>
                    </button>
                ))}
            </div>

            {/* Patient info strip */}
            <div style={{
                marginTop: 32, padding: '14px 20px',
                background: 'rgba(15,23,42,0.6)',
                backdropFilter: 'blur(10px)',
                border: `1px solid ${theme.border}`,
                borderRadius: 12,
                display: 'flex', alignItems: 'center', gap: 12,
                color: theme.textMuted, fontSize: 13,
            }}>
                <span style={{ fontSize: 24 }}>🏥</span>
                <div>
                    Logging for: <b style={{ color: theme.teal }}>{patient.id}</b>
                    {' · '}
                    <b style={{ color: '#fcd34d' }}>{patient.disease}</b>
                </div>
            </div>
        </div>
    );

    // ── Render chosen mode with a back button ──────────────────────────────────
    return (
        <div style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* Role badge + switch button */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 24, padding: '10px 16px',
                background: 'rgba(15,23,42,0.55)',
                backdropFilter: 'blur(10px)',
                border: `1px solid ${theme.border}`,
                borderRadius: 12,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{ROLES.find(r => r.id === role)?.icon}</span>
                    <b style={{ color: theme.text, fontSize: 14 }}>{ROLES.find(r => r.id === role)?.title}</b>
                    <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 8,
                        background: 'rgba(95,179,162,0.15)', color: theme.teal,
                        fontWeight: 700, letterSpacing: '0.06em',
                    }}>
                        {patient.id} · {patient.disease}
                    </span>
                </div>
                <button onClick={() => setRole(null)} style={{
                    background: 'transparent', border: `1px solid ${theme.border}`,
                    borderRadius: 8, padding: '6px 12px', color: theme.textMuted,
                    fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                }}
                    onMouseEnter={e => e.currentTarget.style.color = theme.text}
                    onMouseLeave={e => e.currentTarget.style.color = theme.textMuted}
                >
                    ⇄ Switch Role
                </button>
            </div>

            {role === 'patient' && <GestureInput patient={patient} />}
            {role === 'doctor' && <DoctorInput patient={patient} />}
        </div>
    );
}
