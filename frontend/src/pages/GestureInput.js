// GestureInput.js — Patient gesture-based symptom logger
// Camera Hand uses @mediapipe/tasks-vision (npm) for reliable in-browser hand tracking
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HandLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { addEntry, getDiseaseConfig, computeSignals } from '../api';
import theme from '../theme';

// ─── Shared helpers ─────────────────────────────────────────────────────────────
const SEV_LABELS = ['None', 'Negligible', 'Mild', 'Moderate', 'Significant', 'Severe', 'Extreme'];
const SEV_COLORS = ['#22c55e', '#84cc16', '#a3e635', '#facc15', '#fb923c', '#ef4444', '#b91c1c'];
const sevColor = (v) => SEV_COLORS[Math.min(Math.round((v / 10) * (SEV_COLORS.length - 1)), SEV_COLORS.length - 1)];
const sevLabel = (v) => SEV_LABELS[Math.min(Math.round((v / 10) * (SEV_LABELS.length - 1)), SEV_LABELS.length - 1)];
const fmtSym = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const GESTURE_MODES = [
    { id: 'camera_hand', icon: '📷', label: 'Camera Hand', desc: 'Show hand to webcam — move left➜low to right➜high. Real-time palm tracking.' },
    { id: 'quick_tag', icon: '🏷', label: 'Quick Tag', desc: 'Tap one of 5 tiles — fastest option, no typing needed.' },
    { id: 'swipe', icon: '🖐', label: 'Hand Swipe', desc: 'Drag left/right anywhere on the card to set intensity.' },
    { id: 'dwell', icon: '👁', label: 'Eye Dwell', desc: 'Look at a zone and hold — zones are widely spaced so eye gaze can land cleanly.' },
    { id: 'dial', icon: '🌀', label: 'Breath Dial', desc: 'Spinning colour wheel — click to stop at your severity level.' },
    { id: 'tap_rhythm', icon: '🎮', label: 'Tap Rhythm', desc: 'Tap rapidly for 3 sec — more taps = higher severity.' },
    { id: 'voice_amp', icon: '🎙', label: 'Voice Tone', desc: 'Hum or speak — louder / longer = more severe.' },
    { id: 'pinch', icon: '🤏', label: 'Pinch Zoom', desc: 'Pinch two fingers (touch) or scroll wheel (desktop).' },
];

// ─── Shared UI ──────────────────────────────────────────────────────────────────
function GlassCard({ children, style = {} }) {
    return (
        <div style={{
            background: 'rgba(15,23,42,0.72)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(95,179,162,0.25)', borderRadius: 20,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)', ...style,
        }}>{children}</div>
    );
}

function ProgressArc({ current, total }) {
    const pct = total > 0 ? current / total : 0;
    const r = 36; const circ = 2 * Math.PI * r;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
            <svg width={90} height={90}>
                <circle cx={45} cy={45} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
                <circle cx={45} cy={45} r={r} fill="none" stroke={theme.teal} strokeWidth={6}
                    strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
                    transform="rotate(-90 45 45)" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
                <text x={45} y={50} textAnchor="middle" fill={theme.text} fontSize={15} fontWeight={700}>{current}/{total}</text>
            </svg>
            <div style={{ color: theme.textMuted, fontSize: 12 }}>symptoms logged</div>
        </div>
    );
}

function SeverityRing({ value, size = 140 }) {
    const r = size / 2 - 12; const circ = 2 * Math.PI * r; const col = sevColor(value);
    return (
        <div style={{ position: 'relative', width: size, height: size }}>
            <svg width={size} height={size}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={10}
                    strokeDasharray={circ} strokeDashoffset={circ * (1 - value / 10)} strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'all 0.15s ease' }} />
            </svg>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 900, color: col }}>{value.toFixed(1)}</div>
                <div style={{ fontSize: 11, color: theme.textMuted }}>/ 10</div>
            </div>
        </div>
    );
}


// ══════════════════════════════════════════════════════════════════════════════
// Mode 1: 📷 Camera Hand — @mediapipe/tasks-vision HandLandmarker (npm, React-safe)
// ══════════════════════════════════════════════════════════════════════════════
function CameraHandMode({ value, onChange, onConfirm }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const landmarkerRef = useRef(null);
    const rafRef = useRef(null);
    const mountedRef = useRef(true);
    const confirmedRef = useRef(false);
    const dwellStart = useRef(null);
    const currentVal = useRef(value);
    const [status, setStatus] = useState('loading');
    const [dwellPct, setDwellPct] = useState(0);
    const DWELL_MS = 2000;

    // Per-frame detection callback
    const processFrame = useCallback(() => {
        if (!mountedRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const lmk = landmarkerRef.current;
        if (!video || !canvas || !lmk || video.readyState < 2) {
            rafRef.current = requestAnimationFrame(processFrame);
            return;
        }

        const results = lmk.detectForVideo(video, performance.now());
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Mirror the video
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        if (results?.landmarks?.length > 0) {
            const lms = results.landmarks[0];

            // Draw skeleton
            const drawUtil = new DrawingUtils(ctx);
            ctx.save();
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            drawUtil.drawConnectors(lms, HandLandmarker.HAND_CONNECTIONS, { color: '#5fb3a2', lineWidth: 2 });
            drawUtil.drawLandmarks(lms, { color: '#fff', lineWidth: 1, radius: 3 });
            ctx.restore();

            // Wrist x (mirrored) → severity 0–10
            const wrist = lms[0]; // index 0 = wrist
            const clamped = Math.max(0, Math.min(10, Math.round((1 - wrist.x) * 10 * 2) / 2));
            currentVal.current = clamped;
            onChange(clamped);
            if (mountedRef.current) setStatus('tracking');

            // Auto-confirm on 2-second dwell
            if (!dwellStart.current) {
                dwellStart.current = { time: Date.now(), val: clamped };
            } else if (Math.abs(clamped - dwellStart.current.val) > 0.5) {
                dwellStart.current = { time: Date.now(), val: clamped };
                if (mountedRef.current) setDwellPct(0);
            } else {
                const pct = Math.min((Date.now() - dwellStart.current.time) / DWELL_MS, 1);
                if (mountedRef.current) setDwellPct(pct);
                if (pct >= 1 && !confirmedRef.current) {
                    confirmedRef.current = true;
                    onConfirm(clamped);
                }
            }
        } else {
            dwellStart.current = null;
            if (mountedRef.current) setDwellPct(0);
            if (status === 'tracking' && mountedRef.current) setStatus('ready');
        }

        // Bottom severity overlay
        const col = sevColor(currentVal.current);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, canvas.height - 44, canvas.width, 44);
        ctx.fillStyle = col;
        ctx.fillRect(0, canvas.height - 44, (currentVal.current / 10) * canvas.width, 44);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${sevLabel(currentVal.current)}  ${currentVal.current.toFixed(1)} / 10`, canvas.width / 2, canvas.height - 17);

        rafRef.current = requestAnimationFrame(processFrame);
    }, [onChange, onConfirm, status]);

    useEffect(() => {
        mountedRef.current = true;
        confirmedRef.current = false;
        let stream;

        const init = async () => {
            try {
                // Load tasks-vision WASM (hosted by Google)
                const vision = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
                );
                if (!mountedRef.current) return;
                const lmk = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                        delegate: 'GPU',
                    },
                    runningMode: 'VIDEO',
                    numHands: 1,
                    minHandDetectionConfidence: 0.5,
                    minHandPresenceConfidence: 0.5,
                    minTrackingConfidence: 0.5,
                });
                if (!mountedRef.current) { lmk.close(); return; }
                landmarkerRef.current = lmk;

                stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
                if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
                const vid = videoRef.current;
                vid.srcObject = stream;
                try { await vid.play(); } catch (_) { /* interrupted on fast nav — safe */ }
                if (!mountedRef.current) return;

                if (mountedRef.current) setStatus('ready');
                rafRef.current = requestAnimationFrame(processFrame);
            } catch (err) {
                console.error('Camera Hand init failed:', err);
                if (mountedRef.current) setStatus(err?.name === 'NotAllowedError' ? 'no_cam' : 'unavailable');
            }
        };
        init();

        return () => {
            mountedRef.current = false;
            cancelAnimationFrame(rafRef.current);
            landmarkerRef.current?.close();
            landmarkerRef.current = null;
            const v = videoRef.current;
            if (v?.srcObject) v.srcObject.getTracks().forEach(t => t.stop());
            stream?.getTracks().forEach(t => t.stop());
        };
    }, [processFrame]); // eslint-disable-line

    const col = sevColor(value);
    const dC = 2 * Math.PI * 20;

    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ color: theme.textMuted, fontSize: 13, marginBottom: 12 }}>
                {status === 'loading' && '⏳ Initialising hand detector… (~10 s first time)'}
                {status === 'ready' && '✋ Show your hand — move LEFT (low) ↔ RIGHT (high)'}
                {status === 'tracking' && `📷 Tracking — hold still 2 s to confirm at ${value.toFixed(1)}/10`}
                {status === 'unavailable' && '⚠ Failed to load model — check internet & reload.'}
                {status === 'no_cam' && '🚫 Camera denied — allow in browser settings & reload.'}
            </div>

            <video ref={videoRef} style={{ display: 'none' }} playsInline muted />

            {(status === 'ready' || status === 'tracking') && (
                <div style={{ position: 'relative', display: 'inline-block', borderRadius: 16, overflow: 'hidden', border: `2px solid ${col}66`, boxShadow: `0 0 30px ${col}33` }}>
                    <canvas ref={canvasRef} width={480} height={360} style={{ display: 'block', borderRadius: 14 }} />
                    {dwellPct > 0 && (
                        <svg style={{ position: 'absolute', top: 10, right: 10 }} width={50} height={50}>
                            <circle cx={25} cy={25} r={20} fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.15)" strokeWidth={3} />
                            <circle cx={25} cy={25} r={20} fill="none" stroke={col} strokeWidth={3}
                                strokeDasharray={dC} strokeDashoffset={dC * (1 - dwellPct)}
                                strokeLinecap="round" transform="rotate(-90 25 25)" style={{ transition: 'stroke-dashoffset 0.05s' }} />
                            <text x={25} y={30} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={700}>{Math.round(dwellPct * 100)}%</text>
                        </svg>
                    )}
                </div>
            )}

            {(status === 'ready' || status === 'tracking') && (
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#22c55e' }}>0</span>
                    <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'linear-gradient(90deg,#22c55e,#facc15,#ef4444)', width: `${(value / 10) * 100}%`, transition: 'width 0.1s', borderRadius: 8 }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#ef4444' }}>10</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: col, minWidth: 36 }}>{value.toFixed(1)}</span>
                </div>
            )}

            {(status === 'ready' || status === 'tracking') && (
                <button onClick={() => onConfirm(value)} style={{
                    marginTop: 16, padding: '12px 36px',
                    background: `linear-gradient(135deg, ${col}, ${col}99)`,
                    border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                }}>✓ Confirm {value.toFixed(1)} / 10 now</button>
            )}

            {status === 'loading' && (
                <div style={{ marginTop: 20, padding: '16px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 12, color: '#a5b4fc', fontSize: 12 }}>
                    Loading MediaPipe Tasks hand model… cached after first load.
                </div>
            )}

            {(status === 'unavailable' || status === 'no_cam') && (
                <div style={{ marginTop: 20, padding: '16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, color: theme.textMuted, fontSize: 13 }}>
                    💡 Use another mode below — or fix camera permissions and refresh.
                </div>
            )}
        </div>
    );
}



// ══════════════════════════════════════════════════════════════════════════════
// Mode 2: 🏷 Quick Tag
// ══════════════════════════════════════════════════════════════════════════════
const QUICK_TAGS = [
    { label: 'None', val: 0, col: '#22c55e', emoji: '😊' },
    { label: 'Mild', val: 2.5, col: '#a3e635', emoji: '🙂' },
    { label: 'Moderate', val: 5, col: '#facc15', emoji: '😐' },
    { label: 'Severe', val: 7.5, col: '#fb923c', emoji: '😣' },
    { label: 'Extreme', val: 10, col: '#ef4444', emoji: '😰' },
];
function QuickTagMode({ onConfirm }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {QUICK_TAGS.map(tag => (
                <button key={tag.val} onClick={() => onConfirm(tag.val)} style={{
                    background: `${tag.col}18`, border: `2px solid ${tag.col}55`, borderRadius: 14,
                    padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 16,
                    cursor: 'pointer', transition: 'all 0.18s', color: tag.col, fontSize: 18, fontWeight: 700,
                }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${tag.col}30`; e.currentTarget.style.transform = 'scale(1.02)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${tag.col}18`; e.currentTarget.style.transform = 'scale(1)'; }}>
                    <span style={{ fontSize: 32 }}>{tag.emoji}</span>
                    <div>
                        <div style={{ fontSize: 16 }}>{tag.label}</div>
                        <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 400 }}>{tag.val}/10</div>
                    </div>
                    <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: 20 }}>→</span>
                </button>
            ))}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Mode 3: 🖐 Hand Swipe (drag/mouse)
// ══════════════════════════════════════════════════════════════════════════════
function SwipeMode({ value, onChange, onConfirm }) {
    const dragRef = useRef(null);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const startVal = useRef(value);
    const onPointerDown = (e) => { isDragging.current = true; startX.current = e.clientX; startVal.current = value; dragRef.current.setPointerCapture(e.pointerId); };
    const onPointerMove = (e) => { if (!isDragging.current) return; const dx = e.clientX - startX.current; onChange(Math.max(0, Math.min(10, Math.round((startVal.current + dx / 30) * 2) / 2))); };
    const onPointerUp = () => { isDragging.current = false; };
    const col = sevColor(value);
    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ color: theme.textMuted, fontSize: 13, marginBottom: 16 }}>← Drag to adjust severity →</div>
            <div ref={dragRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
                style={{
                    width: '100%', height: 120, borderRadius: 16, cursor: 'ew-resize', background: `linear-gradient(90deg,#22c55e22,${col}44)`,
                    border: `2px solid ${col}66`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    userSelect: 'none', touchAction: 'none', marginBottom: 20, transition: 'border-color 0.2s'
                }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 36, fontWeight: 900, color: col }}>{value.toFixed(1)}</div>
                    <div style={{ fontSize: 14, color: col, opacity: 0.8 }}>{sevLabel(value)}</div>
                    <div style={{ fontSize: 20, marginTop: 4 }}>↔</div>
                </div>
            </div>
            <input type="range" min={0} max={10} step={0.5} value={value}
                onChange={e => onChange(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: col, height: 6 }} />
            <button onClick={() => onConfirm(value)} style={{
                marginTop: 20, width: '100%', padding: '14px 0', background: `linear-gradient(135deg,${col},${col}99)`,
                border: 'none', borderRadius: 12, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer'
            }}>
                ✓ Confirm {value.toFixed(1)} / 10
            </button>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Mode 4: 👁 Eye Dwell — WIDE zones so eye/gaze can cleanly distinguish
// ══════════════════════════════════════════════════════════════════════════════
const DWELL_ZONES = [
    { val: 0, label: 'None', emoji: '😊', col: '#22c55e' },
    { val: 2.5, label: 'Mild', emoji: '🙂', col: '#a3e635' },
    { val: 5, label: 'Moderate', emoji: '😐', col: '#facc15' },
    { val: 7.5, label: 'Severe', emoji: '😣', col: '#fb923c' },
    { val: 10, label: 'Extreme', emoji: '😰', col: '#ef4444' },
];
function DwellMode({ onConfirm }) {
    const [hovering, setHovering] = useState(null);
    const [progress, setProgress] = useState(0);
    const timerRef = useRef(null);
    const DWELL_MS = 1800;

    const startDwell = (val) => {
        setHovering(val); setProgress(0);
        const start = Date.now();
        timerRef.current = setInterval(() => {
            const p = Math.min((Date.now() - start) / DWELL_MS, 1);
            setProgress(p);
            if (p >= 1) { clearInterval(timerRef.current); onConfirm(val); }
        }, 30);
    };
    const stopDwell = () => { clearInterval(timerRef.current); setHovering(null); setProgress(0); };

    return (
        <div>
            <div style={{ color: theme.textMuted, fontSize: 13, marginBottom: 14, textAlign: 'center' }}>
                👁 Look at / hover a zone — hold for ~2 s to select. Zones are widely spaced for accurate eye gaze.
            </div>
            {/* WIDE vertical stack — each zone is a tall block so eye can clearly land on it */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {DWELL_ZONES.map(zone => {
                    const isHov = hovering === zone.val;
                    const r = 22; const c = 2 * Math.PI * r;
                    return (
                        <div key={zone.val}
                            onMouseEnter={() => startDwell(zone.val)} onMouseLeave={stopDwell}
                            onTouchStart={() => startDwell(zone.val)} onTouchEnd={stopDwell}
                            style={{
                                background: isHov ? `${zone.col}28` : `${zone.col}0e`,
                                border: `2px solid ${isHov ? zone.col : zone.col + '33'}`,
                                borderRadius: 16,
                                padding: '18px 24px',
                                display: 'flex', alignItems: 'center', gap: 18,
                                cursor: 'pointer', transition: 'all 0.2s',
                                transform: isHov ? 'scaleX(1.01)' : 'scaleX(1)',
                            }}>
                            {/* Dwell ring */}
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <svg width={50} height={50}>
                                    <circle cx={25} cy={25} r={r} fill="rgba(0,0,0,0.3)" stroke={zone.col + '44'} strokeWidth={3} />
                                    <circle cx={25} cy={25} r={r} fill="none" stroke={zone.col} strokeWidth={3}
                                        strokeDasharray={c} strokeDashoffset={c * (1 - (isHov ? progress : 0))}
                                        strokeLinecap="round" transform="rotate(-90 25 25)" style={{ transition: 'stroke-dashoffset 0.05s' }} />
                                </svg>
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 20 }}>{zone.emoji}</div>
                            </div>
                            {/* Label */}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 17, fontWeight: 800, color: zone.col }}>{zone.label}</div>
                                <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{zone.val} / 10</div>
                            </div>
                            {/* Progress bar on right */}
                            <div style={{ width: 80 }}>
                                <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 6, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: zone.col, width: `${(isHov ? progress : 0) * 100}%`, transition: 'width 0.05s', borderRadius: 6 }} />
                                </div>
                                {isHov && <div style={{ fontSize: 11, color: zone.col, marginTop: 4, textAlign: 'right' }}>{Math.round(progress * 100)}%</div>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Mode 5: 🌀 Breath Dial
// ══════════════════════════════════════════════════════════════════════════════
function DialMode({ onConfirm }) {
    const [spinning, setSpinning] = useState(true);
    const [angle, setAngle] = useState(0);
    const rafRef = useRef(null); const angleRef = useRef(0);
    useEffect(() => {
        const animate = () => { angleRef.current = (angleRef.current + 1.8) % 360; setAngle(angleRef.current); rafRef.current = requestAnimationFrame(animate); };
        if (spinning) rafRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafRef.current);
    }, [spinning]);
    const stop = () => {
        setSpinning(false); cancelAnimationFrame(rafRef.current);
        const norm = ((angleRef.current % 360) + 360) % 360;
        onConfirm(Math.max(0, Math.min(10, Math.round((norm / 360) * 10 * 2) / 2)));
    };
    const col = sevColor(((angle % 360) / 360) * 10);
    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ color: theme.textMuted, fontSize: 13, marginBottom: 16 }}>{spinning ? 'Click the dial when it points to your severity' : 'Done!'}</div>
            <div onClick={spinning ? stop : undefined} style={{
                width: 200, height: 200, borderRadius: '50%', margin: '0 auto 24px', cursor: spinning ? 'pointer' : 'default',
                background: `conic-gradient(from ${angle}deg,#22c55e,#facc15,#ef4444,#22c55e)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 40px ${col}66`, transition: 'box-shadow 0.3s',
            }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(10,16,30,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>
                    {spinning ? '⏺' : '✓'}
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 20px', color: theme.textMuted, fontSize: 11 }}>
                <span style={{ color: '#22c55e' }}>0 None</span><span style={{ color: '#facc15' }}>5 Moderate</span><span style={{ color: '#ef4444' }}>10 Extreme</span>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Mode 6: 🎮 Tap Rhythm
// ══════════════════════════════════════════════════════════════════════════════
function TapRhythmMode({ onConfirm }) {
    const [taps, setTaps] = useState(0);
    const [active, setActive] = useState(false);
    const [timeLeft, setTimeLeft] = useState(3);
    const [ripples, setRipples] = useState([]);
    const timerRef = useRef(null);
    const start = () => {
        setTaps(0); setActive(true); setTimeLeft(3);
        timerRef.current = setInterval(() => {
            setTimeLeft(t => { if (t <= 1) { clearInterval(timerRef.current); setActive(false); return 0; } return t - 1; });
        }, 1000);
    };
    useEffect(() => { if (!active && timeLeft === 0 && taps > 0) { const v = Math.min(10, Math.round((taps / 15) * 10 * 2) / 2); setTimeout(() => onConfirm(parseFloat(v.toFixed(1))), 600); } }, [active, timeLeft, taps, onConfirm]);
    const handleTap = (e) => { if (!active) return; setTaps(t => t + 1); const r = e.currentTarget.getBoundingClientRect(); const id = Date.now(); setRipples(p => [...p, { id, x: e.clientX - r.left, y: e.clientY - r.top }]); setTimeout(() => setRipples(p => p.filter(r => r.id !== id)), 700); };
    const tempVal = Math.min(10, Math.round((taps / 15) * 10 * 2) / 2); const col = sevColor(tempVal);
    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ color: theme.textMuted, fontSize: 13, marginBottom: 12 }}>Tap the pad rapidly — more taps = higher severity</div>
            <div onClick={handleTap} style={{ width: '100%', height: 200, borderRadius: 18, marginBottom: 16, background: active ? `${col}20` : 'rgba(255,255,255,0.03)', border: `2px dashed ${active ? col : theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: active ? 'pointer' : 'default', position: 'relative', overflow: 'hidden', userSelect: 'none' }}>
                {ripples.map(r => <div key={r.id} style={{ position: 'absolute', left: r.x - 20, top: r.y - 20, width: 40, height: 40, borderRadius: '50%', background: `${col}55`, animation: 'rippleOut 0.7s ease-out forwards', pointerEvents: 'none' }} />)}
                {active ? <div><div style={{ fontSize: 48, color: col, fontWeight: 900 }}>{taps}</div><div style={{ color: col, fontSize: 14 }}>taps · {timeLeft}s left</div></div> : <div style={{ color: theme.textMuted, fontSize: 15 }}>{timeLeft === 0 && taps > 0 ? `Done! ${tempVal}/10` : 'Tap to begin'}</div>}
            </div>
            {!active && (timeLeft > 0 || taps === 0) && <button onClick={start} style={{ width: '100%', padding: '14px', background: `linear-gradient(135deg,${theme.teal},#6366f1)`, border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>🎮 Start (3 sec)</button>}
            <style>{`@keyframes rippleOut{0%{transform:scale(0);opacity:1}100%{transform:scale(4);opacity:0}}`}</style>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Mode 7: 🎙 Voice Amplitude
// ══════════════════════════════════════════════════════════════════════════════
function VoiceAmpMode({ onConfirm }) {
    const [recording, setRecording] = useState(false); const [peak, setPeak] = useState(0); const [bars, setBars] = useState(Array(20).fill(0)); const [done, setDone] = useState(false);
    const peakRef = useRef(0); const rafRef = useRef(null);
    const start = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const ctx = new (window.AudioContext || window.webkitAudioContext)(); const src = ctx.createMediaStreamSource(stream); const analyser = ctx.createAnalyser(); analyser.fftSize = 64; src.connect(analyser);
            peakRef.current = 0; setRecording(true); setDone(false); setPeak(0);
            const data = new Uint8Array(analyser.frequencyBinCount);
            const tick = () => { analyser.getByteFrequencyData(data); const avg = data.reduce((a, b) => a + b, 0) / data.length; const norm = avg / 255; peakRef.current = Math.max(peakRef.current, norm); setPeak(peakRef.current); setBars(Array.from(data).slice(0, 20).map(v => v / 255)); rafRef.current = requestAnimationFrame(tick); }; tick();
            setTimeout(() => { cancelAnimationFrame(rafRef.current); stream.getTracks().forEach(t => t.stop()); ctx.close(); setRecording(false); setDone(true); const v = Math.min(10, Math.round(peakRef.current * 10 * 2) / 2); setTimeout(() => onConfirm(parseFloat(v.toFixed(1))), 500); }, 3000);
        } catch { alert('Microphone permission denied.'); }
    };
    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ color: theme.textMuted, fontSize: 13, marginBottom: 16 }}>Speak or hum — louder & longer = higher severity</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4, height: 80, marginBottom: 20 }}>
                {bars.map((v, i) => <div key={i} style={{ width: 10, height: `${Math.max(4, v * 80)}px`, background: recording ? `hsl(${160 - v * 120},80%,55%)` : 'rgba(255,255,255,0.1)', borderRadius: 4, transition: 'height 0.05s' }} />)}
            </div>
            <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: theme.textMuted }}><span>Silence</span><span>Peak: {(peak * 10).toFixed(1)}/10</span><span>Max</span></div>
                <div style={{ height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 10, background: `linear-gradient(90deg,#22c55e,#facc15,#ef4444)`, width: `${peak * 100}%`, transition: 'width 0.1s' }} /></div>
            </div>
            {!recording && !done && <button onClick={start} style={{ width: '100%', padding: '14px', background: `linear-gradient(135deg,#6366f1,#8b5cf6)`, border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>🎙 Record 3 sec</button>}
            {recording && <div style={{ color: theme.teal, fontSize: 16, fontWeight: 700 }}>🔴 Recording…</div>}
            {done && <div style={{ color: theme.primary, fontSize: 15, fontWeight: 600 }}>✓ Captured!</div>}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Mode 8: 🤏 Pinch Zoom
// ══════════════════════════════════════════════════════════════════════════════
function PinchMode({ value, onChange, onConfirm }) {
    const lastDist = useRef(null); const baseVal = useRef(value);
    const onTouchStart = (e) => { if (e.touches.length === 2) { const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; lastDist.current = Math.sqrt(dx * dx + dy * dy); baseVal.current = value; } };
    const onTouchMove = (e) => { if (e.touches.length === 2) { e.preventDefault(); const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; const dist = Math.sqrt(dx * dx + dy * dy); const delta = (dist - lastDist.current) / 30; onChange(Math.max(0, Math.min(10, Math.round((baseVal.current + delta) * 2) / 2))); } };
    const col = sevColor(value);
    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ color: theme.textMuted, fontSize: 13, marginBottom: 16 }}>Pinch out = higher · Pinch in = lower<br /><span style={{ fontSize: 11 }}>Scroll wheel on desktop</span></div>
            <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onWheel={e => onChange(Math.max(0, Math.min(10, Math.round((value - e.deltaY / 200) * 2) / 2)))} style={{ width: 200, height: 200, borderRadius: '50%', margin: '0 auto 20px', background: `radial-gradient(circle,${col}44,${col}11)`, border: `4px solid ${col}88`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'ns-resize', userSelect: 'none', touchAction: 'none', boxShadow: `0 0 40px ${col}44`, transition: 'all 0.2s' }}>
                <div><div style={{ fontSize: 40, fontWeight: 900, color: col }}>{value.toFixed(1)}</div><div style={{ color: col, fontSize: 13 }}>{sevLabel(value)}</div><div style={{ fontSize: 20, color: theme.textMuted }}>🤏</div></div>
            </div>
            <input type="range" min={0} max={10} step={0.5} value={value} onChange={e => onChange(parseFloat(e.target.value))} style={{ width: '80%', accentColor: col }} />
            <button onClick={() => onConfirm(value)} style={{ display: 'block', margin: '16px auto 0', padding: '12px 40px', background: `linear-gradient(135deg,${col},${col}99)`, border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>✓ Confirm</button>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Trigger selector
// ══════════════════════════════════════════════════════════════════════════════
function TriggerSelector({ triggers: all, selected, onToggle }) {
    return (
        <div>
            <div style={{ color: theme.textMuted, fontSize: 13, marginBottom: 12 }}>Tap any triggers present today (optional)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {all.map(t => {
                    const a = selected.includes(t); return (
                        <button key={t} onClick={() => onToggle(t)} style={{ padding: '10px 14px', borderRadius: 20, border: `1.5px solid ${a ? theme.teal : theme.border}`, background: a ? `linear-gradient(135deg,${theme.tealBg},rgba(17,24,39,0.9))` : theme.surfaceGradient, color: a ? theme.teal : theme.textMuted, fontSize: 13, fontWeight: a ? 700 : 400, cursor: 'pointer', transition: 'all 0.15s' }}>
                            {a ? '✓ ' : ''}{t.replace(/_/g, ' ')}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Patient Context Panel — "Things That May Have Affected Today"
// ══════════════════════════════════════════════════════════════════════════════
function YesNoBtn({ value, current, onSelect, label }) {
    const active = current === value;
    const col = value === 'yes' ? theme.coral : value === 'no' ? theme.primary : theme.amber;
    return (
        <button onClick={() => onSelect(value)} style={{
            flex: 1, padding: '10px 0', borderRadius: 10,
            border: `1.5px solid ${active ? col : theme.borderSoft}`,
            background: active ? `${col}20` : 'transparent',
            color: active ? col : theme.textMuted,
            fontSize: 13, fontWeight: active ? 700 : 400, cursor: 'pointer',
            transition: 'all 0.15s',
        }}>{label || value.charAt(0).toUpperCase() + value.slice(1)}</button>
    );
}

function ChoiceRow({ label, fieldKey, choices, ctx, setCtx }) {
    return (
        <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: theme.textSoft, marginBottom: 8 }}>{label}</div>
            <div style={{ display: 'flex', gap: 8 }}>
                {choices.map(c => (
                    <YesNoBtn key={c.v} value={c.v} current={ctx[fieldKey]}
                        label={c.l} onSelect={v => setCtx(p => ({ ...p, [fieldKey]: v }))} />
                ))}
            </div>
        </div>
    );
}

function PatientContextPanel({ ctx, setCtx, exp, setExp, onSubmit, onBack, loading }) {
    const sectionHead = (txt) => (
        <div style={{
            fontSize: 11, fontWeight: 700, color: theme.teal, textTransform: 'uppercase',
            letterSpacing: 1.4, marginBottom: 14, marginTop: 4, paddingBottom: 6,
            borderBottom: `1px solid ${theme.teal}30`,
        }}>{txt}</div>
    );

    const sleepH = ctx.sleep_duration_hours ?? 8;
    const setSleep = (v) => setCtx(p => ({ ...p, sleep_duration_hours: Math.max(0, Math.min(24, Math.round(v * 2) / 2)) }));

    const toggleExp = (key, val) => setExp(p => ({
        ...p,
        [key]: p[key]?.includes(val) ? p[key].filter(x => x !== val) : [...(p[key] || []), val],
    }));

    const chip = (active, col) => ({
        padding: '9px 14px', borderRadius: 20,
        border: `1.5px solid ${active ? col : theme.borderSoft}`,
        background: active ? `${col}20` : 'transparent',
        color: active ? col : theme.textMuted,
        fontSize: 13, fontWeight: active ? 700 : 400, cursor: 'pointer', transition: 'all 0.15s',
    });

    return (
        <div style={{ fontFamily: "'Inter',sans-serif", color: theme.text }}>

            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>🌙 Things That May Have Affected Today</div>
                <div style={{ color: theme.textMuted, fontSize: 13, lineHeight: 1.6 }}>
                    Add a little context so RareSignal can better understand higher-symptom days without making assumptions.
                </div>
            </div>

            {/* Sleep */}
            {sectionHead('💤 Sleep')}
            <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: theme.textSoft, marginBottom: 8 }}>Sleep duration</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={() => setSleep(sleepH - 0.5)} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${theme.borderSoft}`, background: 'transparent', color: theme.textSoft, fontSize: 18, cursor: 'pointer' }}>−</button>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <span style={{ fontSize: 24, fontWeight: 800, color: theme.teal }}>{sleepH.toFixed(1)}</span>
                        <span style={{ fontSize: 13, color: theme.textMuted, marginLeft: 4 }}>hours</span>
                    </div>
                    <button onClick={() => setSleep(sleepH + 0.5)} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${theme.borderSoft}`, background: 'transparent', color: theme.textSoft, fontSize: 18, cursor: 'pointer' }}>+</button>
                </div>
            </div>
            <ChoiceRow label="Sleep disruption" fieldKey="sleep_disruption"
                choices={[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }]}
                ctx={ctx} setCtx={setCtx} />

            {/* Activity */}
            {sectionHead('🏃 Activity & Exertion')}
            <ChoiceRow label="Activity level today" fieldKey="activity_level"
                choices={[{ v: 'low', l: 'Low' }, { v: 'moderate', l: 'Moderate' }, { v: 'high', l: 'High' }]}
                ctx={ctx} setCtx={setCtx} />
            <ChoiceRow label="Any overexertion?" fieldKey="overexertion"
                choices={[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }]}
                ctx={ctx} setCtx={setCtx} />
            <ChoiceRow label="Did activity worsen symptoms?" fieldKey="activity_worsened_symptoms"
                choices={[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }, { v: 'unsure', l: 'Unsure' }]}
                ctx={ctx} setCtx={setCtx} />

            {/* Stress */}
            {sectionHead('🧠 Stress & Cognitive Load')}
            <ChoiceRow label="Mentally demanding day?" fieldKey="mentally_demanding_day"
                choices={[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }]}
                ctx={ctx} setCtx={setCtx} />
            <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: theme.textSoft, marginBottom: 8 }}>Emotional strain (optional)</div>
                <textarea
                    value={ctx.emotional_strain_note || ''}
                    onChange={e => setCtx(p => ({ ...p, emotional_strain_note: e.target.value }))}
                    placeholder="Optional note about emotional strain or cognitive load…"
                    style={{
                        width: '100%', border: `1px solid ${theme.borderSoft}`, borderRadius: 10,
                        padding: '10px 12px', fontSize: 13, resize: 'vertical', minHeight: 70,
                        background: 'rgba(0,0,0,0.3)', color: theme.text, outline: 'none',
                        boxSizing: 'border-box', fontFamily: "'Inter',sans-serif",
                    }}
                />
            </div>

            {/* Hydration */}
            {sectionHead('💧 Hydration & Nutrition')}
            <ChoiceRow label="Hydration level" fieldKey="hydration_level"
                choices={[{ v: 'low', l: 'Low' }, { v: 'adequate', l: 'Adequate' }, { v: 'high', l: 'High' }]}
                ctx={ctx} setCtx={setCtx} />
            <ChoiceRow label="Large or unusual meals?" fieldKey="large_or_unusual_meals"
                choices={[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }]}
                ctx={ctx} setCtx={setCtx} />
            <ChoiceRow label="Missed meals?" fieldKey="missed_meals"
                choices={[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }]}
                ctx={ctx} setCtx={setCtx} />

            {/* Environment */}
            {sectionHead('🌡 Environment & Context')}
            <ChoiceRow label="Heat exposure" fieldKey="heat_exposure"
                choices={[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }]}
                ctx={ctx} setCtx={setCtx} />
            <ChoiceRow label="Cold exposure" fieldKey="cold_exposure"
                choices={[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }]}
                ctx={ctx} setCtx={setCtx} />
            <ChoiceRow label="Illness or infection symptoms" fieldKey="illness_symptoms"
                choices={[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }]}
                ctx={ctx} setCtx={setCtx} />
            <ChoiceRow label="Travel or routine change" fieldKey="travel_or_routine_change"
                choices={[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }]}
                ctx={ctx} setCtx={setCtx} />

            {/* Anonymous Shared Experience */}
            <div style={{ marginTop: 28, paddingTop: 24, borderTop: `1px solid ${theme.border}` }}>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>💙 Anonymous Shared Experience</div>
                <div style={{ color: theme.textMuted, fontSize: 13, lineHeight: 1.65, marginBottom: 18 }}>
                    You can add a brief anonymous experience from today to help others with this condition feel less alone.
                </div>

                <GlassCard style={{ padding: 18, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: theme.primary, marginBottom: 12 }}>💚 What helped today?</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {['Hydration', 'Pacing activity', 'Rest breaks', 'Quiet time', 'Regular meals', 'Protecting sleep'].map(opt => {
                            const active = (exp.helpful || []).includes(opt);
                            return <button key={opt} onClick={() => toggleExp('helpful', opt)} style={chip(active, theme.primary)}>{active ? '✓ ' : ''}{opt}</button>;
                        })}
                    </div>
                </GlassCard>

                <GlassCard style={{ padding: 18, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: theme.coral, marginBottom: 12 }}>🔴 What made today harder?</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {['Overexertion', 'Poor sleep', 'Heat exposure', 'Stress load', 'Routine change', 'Large or unusual meals'].map(opt => {
                            const active = (exp.harder || []).includes(opt);
                            return <button key={opt} onClick={() => toggleExp('harder', opt)} style={chip(active, theme.coral)}>{active ? '✓ ' : ''}{opt}</button>;
                        })}
                    </div>
                </GlassCard>

                <GlassCard style={{ padding: 18, marginBottom: 24 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: theme.amber, marginBottom: 8 }}>
                        ✨ Anything you wish you had known earlier? <span style={{ fontWeight: 400, color: theme.textMuted }}>(optional)</span>
                    </div>
                    <textarea
                        value={exp.wisdom_snippet || ''}
                        onChange={e => setExp(p => ({ ...p, wisdom_snippet: e.target.value }))}
                        placeholder="One short sentence only…"
                        maxLength={160}
                        style={{
                            width: '100%', border: `1px solid ${theme.borderSoft}`, borderRadius: 10,
                            padding: '10px 12px', fontSize: 13, resize: 'vertical', minHeight: 60,
                            background: 'rgba(0,0,0,0.3)', color: theme.text, outline: 'none',
                            boxSizing: 'border-box', fontFamily: "'Inter',sans-serif",
                        }}
                    />
                    <div style={{ fontSize: 11, color: theme.textMuted, textAlign: 'right', marginTop: 4 }}>{(exp.wisdom_snippet || '').length}/160</div>
                </GlassCard>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={onSubmit} disabled={loading} style={{
                    width: '100%', padding: '14px',
                    background: loading ? 'rgba(95,179,162,0.3)' : `linear-gradient(135deg,${theme.primary},${theme.primaryDeep})`,
                    border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                }}>
                    {loading ? '⏳ Saving…' : '⚡ Save Entry & Update Signals'}
                </button>
                <button onClick={onBack} disabled={loading} style={{
                    width: '100%', background: 'transparent',
                    border: `1px solid ${theme.border}`, borderRadius: 12,
                    padding: '10px', color: theme.textMuted, cursor: 'pointer', fontSize: 13,
                }}>← Back to triggers</button>
            </div>
        </div>
    );
}



// ══════════════════════════════════════════════════════════════════════════════
// Main GestureInput page
// ══════════════════════════════════════════════════════════════════════════════
export default function GestureInput({ patient }) {
    const [phase, setPhase] = useState('pick_mode');
    const [mode, setMode] = useState(null);
    const [config, setConfig] = useState(null);
    const [symptoms, setSymptoms] = useState({});
    const [symIdx, setSymIdx] = useState(0);
    const [currentVal, setCurrentVal] = useState(5);
    const [selectedTriggers, setSelectedTriggers] = useState([]);
    const [lifestyleCtx, setLifestyleCtx] = useState({ sleep_duration_hours: 8 });
    const [sharedExp, setSharedExp] = useState({});
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        if (!patient?.disease) return;
        getDiseaseConfig(patient.disease).then(r => { setConfig(r.data); setSymptoms({}); setSymIdx(0); }).catch(() => { });
    }, [patient?.disease]);

    const symList = config?.symptoms || [];
    const currentSym = symList[symIdx];

    const confirmValue = useCallback((val) => {
        const updated = { ...symptoms, [currentSym]: parseFloat(val.toFixed(1)) };
        setSymptoms(updated);
        if (symIdx + 1 < symList.length) { setSymIdx(i => i + 1); setCurrentVal(5); }
        else setPhase('triggers');
    }, [symptoms, currentSym, symIdx, symList.length]);

    const toggleTrigger = (t) => setSelectedTriggers(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

    const submit = async (ctx = lifestyleCtx, exp = sharedExp) => {
        setLoading(true);
        try {
            await addEntry({
                patient_id: patient.id,
                symptoms,
                triggers: selectedTriggers,
                lifestyle_context: ctx,
                shared_experience: exp,
            });
            await computeSignals(patient.id, 7);
            setResult({ ok: true });
        } catch (e) { setResult({ ok: false, msg: e.response?.data?.detail || 'Submit failed' }); }
        finally { setLoading(false); setPhase('done'); }
    };

    const reset = () => {
        setPhase('pick_mode'); setMode(null); setSymptoms({}); setSymIdx(0);
        setSelectedTriggers([]); setLifestyleCtx({ sleep_duration_hours: 8 });
        setSharedExp({}); setResult(null); setCurrentVal(5);
    };

    const renderMode = () => {
        const props = { value: currentVal, onChange: setCurrentVal, onConfirm: confirmValue };
        switch (mode) {
            case 'camera_hand': return <CameraHandMode {...props} />;
            case 'quick_tag': return <QuickTagMode   {...props} />;
            case 'swipe': return <SwipeMode       {...props} />;
            case 'dwell': return <DwellMode       {...props} />;
            case 'dial': return <DialMode        {...props} />;
            case 'tap_rhythm': return <TapRhythmMode   {...props} />;
            case 'voice_amp': return <VoiceAmpMode    {...props} />;
            case 'pinch': return <PinchMode       {...props} />;
            default: return null;
        }
    };

    const page = { minHeight: '100vh', padding: '24px 20px', fontFamily: "'Inter',sans-serif", color: theme.text };

    // Phase: pick mode
    if (phase === 'pick_mode') return (
        <div style={page}>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🖐 Easy Symptom Input</h2>
            <p style={{ color: theme.textMuted, fontSize: 14, marginBottom: 24 }}>Pick the input style that feels easiest today.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
                {GESTURE_MODES.map(m => (
                    <GlassCard key={m.id} style={{ transition: 'all 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 24px 60px rgba(0,0,0,0.6)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 20px 60px rgba(0,0,0,0.5)'; }}>
                        <button onClick={() => { setMode(m.id); setPhase('log'); setSymIdx(0); setCurrentVal(5); }}
                            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '20px', textAlign: 'left' }}>
                            <div style={{ fontSize: 32, marginBottom: 8 }}>{m.icon}</div>
                            <div style={{ fontWeight: 700, fontSize: 15, color: theme.text, marginBottom: 4 }}>{m.label}</div>
                            <div style={{ color: theme.textMuted, fontSize: 13 }}>{m.desc}</div>
                            {m.id === 'camera_hand' && <div style={{ marginTop: 8, fontSize: 11, padding: '4px 8px', borderRadius: 8, background: 'rgba(95,179,162,0.12)', border: '1px solid rgba(95,179,162,0.3)', color: theme.teal, display: 'inline-block' }}>🔬 MediaPipe · Client-side WASM</div>}
                            {m.id === 'dwell' && <div style={{ marginTop: 8, fontSize: 11, padding: '4px 8px', borderRadius: 8, background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.25)', color: '#fcd34d', display: 'inline-block' }}>👁 Wide-zone layout for eye gaze</div>}
                        </button>
                    </GlassCard>
                ))}
            </div>
        </div>
    );

    // Phase: log symptoms
    if (phase === 'log') return (
        <div style={page}>
            <div style={{ maxWidth: 520, margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <button onClick={reset} style={{ background: 'none', border: `1px solid ${theme.border}`, borderRadius: 8, padding: '6px 12px', color: theme.textMuted, cursor: 'pointer', fontSize: 13 }}>← Change mode</button>
                    <div style={{ color: theme.textMuted, fontSize: 13 }}>{GESTURE_MODES.find(m => m.id === mode)?.icon} {GESTURE_MODES.find(m => m.id === mode)?.label}</div>
                </div>
                <ProgressArc current={symIdx} total={symList.length} />
                <GlassCard style={{ padding: 28, marginBottom: 16 }}>
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                        <div style={{ color: theme.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>How severe is…</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: theme.text, marginBottom: 16 }}>{fmtSym(currentSym || '')}</div>
                        <div style={{ display: 'flex', justifyContent: 'center' }}><SeverityRing value={currentVal} /></div>
                        <div style={{ marginTop: 8, color: sevColor(currentVal), fontWeight: 700, fontSize: 14 }}>{sevLabel(currentVal)}</div>
                    </div>
                    {renderMode()}
                </GlassCard>
                {symIdx > 0 && <button onClick={() => setSymIdx(i => i - 1)} style={{ background: 'transparent', border: `1px solid ${theme.border}`, borderRadius: 8, padding: '8px 18px', color: theme.textMuted, cursor: 'pointer', fontSize: 13 }}>← Back</button>}
            </div>
        </div>
    );

    // Phase: triggers
    if (phase === 'triggers') return (
        <div style={page}>
            <div style={{ maxWidth: 520, margin: '0 auto' }}>
                <GlassCard style={{ padding: 28 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>✅ Symptoms logged!</div>
                    <div style={{ color: theme.textMuted, fontSize: 14, marginBottom: 24 }}>{Object.keys(symptoms).length} symptoms captured. Any triggers today?</div>
                    <TriggerSelector triggers={config?.triggers || []} selected={selectedTriggers} onToggle={toggleTrigger} />
                    <button onClick={() => setPhase('context')} style={{ marginTop: 24, width: '100%', padding: '14px', background: `linear-gradient(135deg,${theme.primary},${theme.primaryDeep})`, border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                        Next → Add Context ⚡
                    </button>
                    <button onClick={() => submit({}, {})} disabled={loading} style={{ marginTop: 10, width: '100%', background: 'transparent', border: `1px solid ${theme.border}`, borderRadius: 12, padding: '10px', color: theme.textMuted, cursor: 'pointer', fontSize: 13 }}>
                        {loading ? '⏳ Saving…' : 'Skip & Save Entry Now'}
                    </button>
                    <button onClick={() => setPhase('log')} style={{ marginTop: 8, width: '100%', background: 'transparent', border: `1px solid ${theme.border}22`, borderRadius: 12, padding: '8px', color: theme.textMuted, cursor: 'pointer', fontSize: 12 }}>← Review symptoms</button>
                </GlassCard>
            </div>
        </div>
    );

    // Phase: context (Things That May Have Affected Today + Shared Experience)
    if (phase === 'context') return (
        <div style={page}>
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
                <GlassCard style={{ padding: 28 }}>
                    <PatientContextPanel
                        ctx={lifestyleCtx}
                        setCtx={setLifestyleCtx}
                        exp={sharedExp}
                        setExp={setSharedExp}
                        onSubmit={() => submit(lifestyleCtx, sharedExp)}
                        onBack={() => setPhase('triggers')}
                        loading={loading}
                    />
                </GlassCard>
            </div>
        </div>
    );

    // Phase: done
    if (phase === 'done') return (
        <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GlassCard style={{ padding: 40, textAlign: 'center', maxWidth: 400 }}>
                <div style={{ fontSize: 60, marginBottom: 16 }}>{result?.ok ? '🎉' : '⚠'}</div>
                <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: result?.ok ? theme.primary : theme.coral }}>{result?.ok ? 'Entry Saved!' : 'Error'}</div>
                <div style={{ color: theme.textMuted, fontSize: 14, marginBottom: 8 }}>{result?.ok ? 'Symptom log saved and signals recomputed.' : result?.msg}</div>
                {result?.ok && <div style={{ fontSize: 12, color: theme.teal, marginBottom: 20 }}>✅ Clinician View &amp; History charts are now current</div>}
                <button onClick={reset} style={{ padding: '12px 32px', background: `linear-gradient(135deg,${theme.teal},${theme.primary})`, border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Log another day</button>
            </GlassCard>
        </div>
    );

    return <div style={page}><div style={{ color: theme.textMuted }}>Loading disease config…</div></div>;
}
