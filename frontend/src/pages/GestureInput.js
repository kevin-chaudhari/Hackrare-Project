// GestureInput.js — Patient gesture-based symptom logger
// Camera Hand uses @mediapipe/tasks-vision (npm) for reliable in-browser hand tracking
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HandLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { addEntry, getDiseaseConfig, computeSignals } from '../api';
import { useLang } from '../i18n/LanguageContext';
import theme from '../theme';

// ─── Shared helpers ─────────────────────────────────────────────────────────────
const SEV_LABELS = ['None', 'Negligible', 'Mild', 'Moderate', 'Significant', 'Severe', 'Extreme'];
const SEV_COLORS = ['#22c55e', '#84cc16', '#a3e635', '#facc15', '#fb923c', '#ef4444', '#b91c1c'];
const sevColor = (v) => SEV_COLORS[Math.min(Math.round((v / 10) * (SEV_COLORS.length - 1)), SEV_COLORS.length - 1)];
const sevLabel = (v, labels = SEV_LABELS) => labels[Math.min(Math.round((v / 10) * (labels.length - 1)), labels.length - 1)];
const fmtSym = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const GESTURE_MODES = [
    { id: 'camera_hand', icon: '📷' },
    { id: 'quick_tag', icon: '🏷' },
    { id: 'swipe', icon: '🖐' },
    { id: 'dial', icon: '🌀' },
    { id: 'tap_rhythm', icon: '🎮' },
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
    const { t } = useLang();
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
            <div style={{ color: theme.textMuted, fontSize: 12 }}>{t.gestureProgressLogged}</div>
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
    const { t } = useLang();
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const landmarkerRef = useRef(null);
    const rafRef = useRef(null);
    const mountedRef = useRef(true);
    const confirmedRef = useRef(false);
    const dwellStart = useRef(null);
    const [status, setStatus] = useState('loading');
    const [dwellPct, setDwellPct] = useState(0);
    const DWELL_MS = 2000;
    const currentVal = useRef(value);

    const confirmCurrentValue = useCallback((nextValue) => {
        if (confirmedRef.current) return;
        confirmedRef.current = true;
        onConfirm(nextValue);
    }, [onConfirm]);

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
                if (pct >= 1) {
                    confirmCurrentValue(clamped);
                }
            }
        } else {
            dwellStart.current = null;
            if (mountedRef.current) setDwellPct(0);
            if (status === 'tracking' && mountedRef.current) setStatus('ready');
        }

        // Bottom severity overlay
        const col = sevColor(currentVal.current);
        const labels = t.gestureSeverityLabels || SEV_LABELS;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, canvas.height - 44, canvas.width, 44);
        ctx.fillStyle = col;
        ctx.fillRect(0, canvas.height - 44, (currentVal.current / 10) * canvas.width, 44);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${sevLabel(currentVal.current, labels)}  ${currentVal.current.toFixed(1)} / 10`, canvas.width / 2, canvas.height - 17);

        rafRef.current = requestAnimationFrame(processFrame);
    }, [confirmCurrentValue, onChange, status]);

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
                {status === 'loading' && `⏳ ${t.gestureCameraLoading}`}
                {status === 'ready' && `✋ ${t.gestureCameraReady}`}
                {status === 'tracking' && `📷 ${t.gestureCameraTracking(value)}`}
                {status === 'unavailable' && `⚠ ${t.gestureCameraUnavailable}`}
                {status === 'no_cam' && `🚫 ${t.gestureCameraDenied}`}
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
                <button onClick={() => confirmCurrentValue(value)} style={{
                    marginTop: 16, padding: '12px 36px',
                    background: `linear-gradient(135deg, ${col}, ${col}99)`,
                    border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                }}>✓ {t.gestureCameraConfirm(value)}</button>
            )}
            {(status === 'ready' || status === 'tracking') && (
                <div style={{ marginTop: 10, fontSize: 12, color: theme.textMuted }}>
                    {t.gestureCameraHint}
                </div>
            )}

            {status === 'loading' && (
                <div style={{ marginTop: 20, padding: '16px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 12, color: '#a5b4fc', fontSize: 12 }}>
                    {t.gestureCameraLoadingModel}
                </div>
            )}

            {(status === 'unavailable' || status === 'no_cam') && (
                <div style={{ marginTop: 20, padding: '16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, color: theme.textMuted, fontSize: 13 }}>
                    💡 {t.gestureCameraFallback}
                </div>
            )}
        </div>
    );
}



// ══════════════════════════════════════════════════════════════════════════════
// Mode 2: 🏷 Quick Tag
// ══════════════════════════════════════════════════════════════════════════════
function QuickTagMode({ onConfirm }) {
    const { t } = useLang();
    const labels = t.gestureSeverityLabels || SEV_LABELS;
    const quickTags = [
        { label: labels[0], val: 0, col: '#22c55e', emoji: '😊' },
        { label: labels[2], val: 2.5, col: '#a3e635', emoji: '🙂' },
        { label: labels[3], val: 5, col: '#facc15', emoji: '😐' },
        { label: labels[5], val: 7.5, col: '#fb923c', emoji: '😣' },
        { label: labels[6], val: 10, col: '#ef4444', emoji: '😰' },
    ];
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {quickTags.map(tag => (
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
    const { t } = useLang();
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
            <div style={{ color: theme.textMuted, fontSize: 13, marginBottom: 16 }}>← {t.gestureSwipeHint} →</div>
            <div ref={dragRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
                style={{
                    width: '100%', height: 120, borderRadius: 16, cursor: 'ew-resize', background: `linear-gradient(90deg,#22c55e22,${col}44)`,
                    border: `2px solid ${col}66`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    userSelect: 'none', touchAction: 'none', marginBottom: 20, transition: 'border-color 0.2s'
                }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 36, fontWeight: 900, color: col }}>{value.toFixed(1)}</div>
                    <div style={{ fontSize: 14, color: col, opacity: 0.8 }}>{sevLabel(value, t.gestureSeverityLabels || SEV_LABELS)}</div>
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
                ✓ {t.gestureConfirmValue(value)}
            </button>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Mode 4: 🌀 Breath Dial
// ══════════════════════════════════════════════════════════════════════════════
function DialMode({ value, onChange, onConfirm }) {
    const { t } = useLang();
    const dialRef = useRef(null);
    const draggingRef = useRef(false);
    const col = sevColor(value);
    const angle = (value / 10) * 360;

    const updateFromPointer = (event) => {
        const dial = dialRef.current;
        if (!dial) return;
        const rect = dial.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = event.clientX - centerX;
        const dy = event.clientY - centerY;
        let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        if (deg < 0) deg += 360;
        const next = Math.max(0, Math.min(10, Math.round((deg / 360) * 10 * 2) / 2));
        onChange(next);
    };

    const onPointerDown = (event) => {
        draggingRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        updateFromPointer(event);
    };

    const onPointerMove = (event) => {
        if (!draggingRef.current) return;
        updateFromPointer(event);
    };

    const onPointerUp = () => {
        draggingRef.current = false;
    };

    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ color: theme.textMuted, fontSize: 13, marginBottom: 16 }}>
                {t.gestureDialHint}
            </div>
            <div
                ref={dialRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                style={{
                    width: 220,
                    height: 220,
                    borderRadius: '50%',
                    margin: '0 auto 20px',
                    position: 'relative',
                    cursor: 'grab',
                    userSelect: 'none',
                    touchAction: 'none',
                    background: `conic-gradient(from -90deg, #22c55e, #facc15, #ef4444, #22c55e)`,
                    boxShadow: `0 0 40px ${col}33`,
                }}
            >
                <div style={{
                    position: 'absolute',
                    inset: 18,
                    borderRadius: '50%',
                    background: 'rgba(10,16,30,0.92)',
                    border: `1px solid ${theme.border}`,
                }} />
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: 8,
                    height: 92,
                    transformOrigin: '50% 100%',
                    transform: `translate(-50%, -100%) rotate(${angle}deg)`,
                    pointerEvents: 'none',
                }}>
                    <div style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: 999,
                        background: `linear-gradient(180deg, ${col}, ${col}66)`,
                        boxShadow: `0 0 12px ${col}55`,
                    }} />
                </div>
                <div style={{
                    position: 'absolute',
                    inset: 52,
                    borderRadius: '50%',
                    background: 'rgba(17,24,39,0.96)',
                    border: `2px solid ${col}55`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <div style={{ fontSize: 34, fontWeight: 900, color: col }}>{value.toFixed(1)}</div>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{sevLabel(value, t.gestureSeverityLabels || SEV_LABELS)}</div>
                </div>
            </div>
            <input
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: col, height: 6 }}
            />
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', color: theme.textMuted, fontSize: 11 }}>
                <span>{t.gestureDialLow}</span>
                <span>{t.gestureDialMid}</span>
                <span>{t.gestureDialHigh}</span>
            </div>
            <button
                onClick={() => onConfirm(value)}
                style={{
                    marginTop: 18,
                    width: '100%',
                    padding: '14px 0',
                    background: `linear-gradient(135deg,${col},${col}99)`,
                    border: 'none',
                    borderRadius: 12,
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: 'pointer',
                }}
            >
                ✓ {t.gestureConfirmValue(value)}
            </button>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Mode 5: 🎮 Tap Rhythm
// ══════════════════════════════════════════════════════════════════════════════
function TapRhythmMode({ onChange, onConfirm, stepKey }) {
    const { t } = useLang();
    const [taps, setTaps] = useState(0);
    const [ripples, setRipples] = useState([]);
    const computedValue = Math.min(10, Math.round((taps / 15) * 10 * 2) / 2);
    const col = sevColor(computedValue);

    useEffect(() => {
        setTaps(0);
        setRipples([]);
        onChange(0);
    }, [stepKey, onChange]);

    const handleTap = (e) => {
        let nextTapCount = 0;
        setTaps((t) => {
            nextTapCount = t + 1;
            return nextTapCount;
        });
        const r = e.currentTarget.getBoundingClientRect();
        const pointerX = e.clientX ?? (e.touches?.[0]?.clientX ?? r.left + r.width / 2);
        const pointerY = e.clientY ?? (e.touches?.[0]?.clientY ?? r.top + r.height / 2);
        const id = `${Date.now()}-${Math.random()}`;
        setRipples((p) => [...p, { id, x: pointerX - r.left, y: pointerY - r.top }]);
        setTimeout(() => setRipples((p) => p.filter((ripple) => ripple.id !== id)), 700);
        const nextValue = Math.min(10, Math.round((nextTapCount / 15) * 10 * 2) / 2);
        onChange(nextValue);
    };

    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ color: theme.textMuted, fontSize: 13, marginBottom: 12 }}>
                {t.gestureTapHint}
            </div>
            <div
                onPointerDown={handleTap}
                style={{
                    width: '100%',
                    height: 200,
                    borderRadius: 18,
                    marginBottom: 16,
                    background: taps > 0 ? `${col}20` : 'rgba(255,255,255,0.03)',
                    border: `2px dashed ${taps > 0 ? col : theme.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    userSelect: 'none',
                    touchAction: 'manipulation',
                }}
            >
                {ripples.map((r) => (
                    <div
                        key={r.id}
                        style={{
                            position: 'absolute',
                            left: r.x - 20,
                            top: r.y - 20,
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            background: `${col}55`,
                            animation: 'rippleOut 0.7s ease-out forwards',
                            pointerEvents: 'none'
                        }}
                    />
                ))}
                {taps > 0 ? (
                    <div>
                        <div style={{ fontSize: 48, color: col, fontWeight: 900 }}>{taps}</div>
                        <div style={{ color: col, fontSize: 14 }}>{t.gestureTapFromTaps(computedValue)}</div>
                    </div>
                ) : (
                    <div style={{ color: theme.textMuted, fontSize: 15 }}>{t.gestureTapStart}</div>
                )}
            </div>
            <button
                onClick={() => onConfirm(parseFloat(computedValue.toFixed(1)))}
                disabled={taps === 0}
                style={{
                    width: '100%',
                    padding: '14px',
                    background: taps > 0 ? `linear-gradient(135deg,${col},${col}99)` : 'rgba(143,163,184,0.18)',
                    border: 'none',
                    borderRadius: 12,
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: taps > 0 ? 'pointer' : 'not-allowed'
                }}
            >
                ✓ {t.gestureTapConfirm(computedValue)}
            </button>
            <button
                onClick={() => {
                    setTaps(0);
                    setRipples([]);
                    onChange(0);
                }}
                style={{ marginTop: 10, width: '100%', padding: '10px', background: 'transparent', border: `1px solid ${theme.border}`, borderRadius: 12, color: theme.textMuted, fontSize: 13, cursor: 'pointer' }}
            >
                {t.gestureTapReset}
            </button>
            <style>{`@keyframes rippleOut{0%{transform:scale(0);opacity:1}100%{transform:scale(4);opacity:0}}`}</style>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Trigger selector
// ══════════════════════════════════════════════════════════════════════════════
function TriggerSelector({ triggers: all, selected, onToggle }) {
    const { t } = useLang();
    return (
        <div>
            <div style={{ color: theme.textMuted, fontSize: 13, marginBottom: 12 }}>{t.gestureTriggerHint}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {all.map((triggerKey) => {
                    const a = selected.includes(triggerKey); return (
                        <button key={triggerKey} onClick={() => onToggle(triggerKey)} style={{ padding: '10px 14px', borderRadius: 20, border: `1.5px solid ${a ? theme.teal : theme.border}`, background: a ? `linear-gradient(135deg,${theme.tealBg},rgba(17,24,39,0.9))` : theme.surfaceGradient, color: a ? theme.teal : theme.textMuted, fontSize: 13, fontWeight: a ? 700 : 400, cursor: 'pointer', transition: 'all 0.15s' }}>
                            {a ? '✓ ' : ''}{t.triggers?.[triggerKey] || triggerKey.replace(/_/g, ' ')}
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
    const { t } = useLang();
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
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>🌙 {t.contextTitle}</div>
                <div style={{ color: theme.textMuted, fontSize: 13, lineHeight: 1.6 }}>
                    {t.contextSub}
                </div>
            </div>

            {/* Sleep */}
            {sectionHead(`💤 ${t.sleepDomain}`)}
            <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: theme.textSoft, marginBottom: 8 }}>{t.sleepDurationLabel}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={() => setSleep(sleepH - 0.5)} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${theme.borderSoft}`, background: 'transparent', color: theme.textSoft, fontSize: 18, cursor: 'pointer' }}>−</button>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <span style={{ fontSize: 24, fontWeight: 800, color: theme.teal }}>{sleepH.toFixed(1)}</span>
                        <span style={{ fontSize: 13, color: theme.textMuted, marginLeft: 4 }}>{t.sleepDurationHours(sleepH).replace(`${sleepH.toFixed(1)} `, '')}</span>
                    </div>
                    <button onClick={() => setSleep(sleepH + 0.5)} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${theme.borderSoft}`, background: 'transparent', color: theme.textSoft, fontSize: 18, cursor: 'pointer' }}>+</button>
                </div>
            </div>
            <ChoiceRow label={t.sleepDisruptionLabel} fieldKey="sleep_disruption"
                choices={[{ v: 'yes', l: t.choiceYes }, { v: 'no', l: t.choiceNo }]}
                ctx={ctx} setCtx={setCtx} />

            {/* Activity */}
            {sectionHead(`🏃 ${t.activityDomain}`)}
            <ChoiceRow label={t.activityLevelLabel} fieldKey="activity_level"
                choices={[{ v: 'low', l: t.choiceLow }, { v: 'moderate', l: t.choiceModerate }, { v: 'high', l: t.choiceHigh }]}
                ctx={ctx} setCtx={setCtx} />
            <ChoiceRow label={t.overexertionLabel} fieldKey="overexertion"
                choices={[{ v: 'yes', l: t.choiceYes }, { v: 'no', l: t.choiceNo }]}
                ctx={ctx} setCtx={setCtx} />
            <ChoiceRow label={t.activityWorsenedLabel} fieldKey="activity_worsened_symptoms"
                choices={[{ v: 'yes', l: t.choiceYes }, { v: 'no', l: t.choiceNo }, { v: 'unsure', l: t.choiceUnsure }]}
                ctx={ctx} setCtx={setCtx} />

            {/* Stress */}
            {sectionHead(`🧠 ${t.stressDomain}`)}
            <ChoiceRow label={t.mentallyDemandingLabel} fieldKey="mentally_demanding_day"
                choices={[{ v: 'yes', l: t.choiceYes }, { v: 'no', l: t.choiceNo }]}
                ctx={ctx} setCtx={setCtx} />
            <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: theme.textSoft, marginBottom: 8 }}>{t.emotionalStrainLabel}</div>
                <textarea
                    value={ctx.emotional_strain_note || ''}
                    onChange={e => setCtx(p => ({ ...p, emotional_strain_note: e.target.value }))}
                    placeholder={t.emotionalStrainPlaceholder}
                    style={{
                        width: '100%', border: `1px solid ${theme.borderSoft}`, borderRadius: 10,
                        padding: '10px 12px', fontSize: 13, resize: 'vertical', minHeight: 70,
                        background: 'rgba(0,0,0,0.3)', color: theme.text, outline: 'none',
                        boxSizing: 'border-box', fontFamily: "'Inter',sans-serif",
                    }}
                />
            </div>

            {/* Hydration */}
            {sectionHead(`💧 ${t.hydrationDomain}`)}
            <ChoiceRow label={t.hydrationLabel} fieldKey="hydration_level"
                choices={[{ v: 'low', l: t.choiceLow }, { v: 'adequate', l: t.choiceAdequate }, { v: 'high', l: t.choiceHigh }]}
                ctx={ctx} setCtx={setCtx} />
            <ChoiceRow label={t.unusualMealsLabel} fieldKey="large_or_unusual_meals"
                choices={[{ v: 'yes', l: t.choiceYes }, { v: 'no', l: t.choiceNo }]}
                ctx={ctx} setCtx={setCtx} />
            <ChoiceRow label={t.missedMealsLabel} fieldKey="missed_meals"
                choices={[{ v: 'yes', l: t.choiceYes }, { v: 'no', l: t.choiceNo }]}
                ctx={ctx} setCtx={setCtx} />

            {/* Environment */}
            {sectionHead(`🌡 ${t.environmentDomain}`)}
            <ChoiceRow label={t.heatExposureLabel} fieldKey="heat_exposure"
                choices={[{ v: 'yes', l: t.choiceYes }, { v: 'no', l: t.choiceNo }]}
                ctx={ctx} setCtx={setCtx} />
            <ChoiceRow label={t.coldExposureLabel} fieldKey="cold_exposure"
                choices={[{ v: 'yes', l: t.choiceYes }, { v: 'no', l: t.choiceNo }]}
                ctx={ctx} setCtx={setCtx} />
            <ChoiceRow label={t.illnessSymptomsLabel} fieldKey="illness_symptoms"
                choices={[{ v: 'yes', l: t.choiceYes }, { v: 'no', l: t.choiceNo }]}
                ctx={ctx} setCtx={setCtx} />
            <ChoiceRow label={t.travelChangeLabel} fieldKey="travel_or_routine_change"
                choices={[{ v: 'yes', l: t.choiceYes }, { v: 'no', l: t.choiceNo }]}
                ctx={ctx} setCtx={setCtx} />

            {/* Anonymous Shared Experience */}
            <div style={{ marginTop: 28, paddingTop: 24, borderTop: `1px solid ${theme.border}` }}>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>💙 {t.shareTitle}</div>
                <div style={{ color: theme.textMuted, fontSize: 13, lineHeight: 1.65, marginBottom: 18 }}>
                    {t.shareSub}
                </div>

                <GlassCard style={{ padding: 18, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: theme.primary, marginBottom: 12 }}>💚 {t.shareHelpfulLabel}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {[
                            t.shareOptionHydration,
                            t.shareOptionPacing,
                            t.shareOptionRestBreaks,
                            t.shareOptionQuietTime,
                            t.shareOptionRegularMeals,
                            t.shareOptionSleepProtection,
                        ].map(opt => {
                            const active = (exp.helpful || []).includes(opt);
                            return <button key={opt} onClick={() => toggleExp('helpful', opt)} style={chip(active, theme.primary)}>{active ? '✓ ' : ''}{opt}</button>;
                        })}
                    </div>
                </GlassCard>

                <GlassCard style={{ padding: 18, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: theme.coral, marginBottom: 12 }}>🔴 {t.shareHarderLabel}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {[
                            t.shareOptionOverexertion,
                            t.shareOptionPoorSleep,
                            t.shareOptionHeat,
                            t.shareOptionStressLoad,
                            t.shareOptionRoutineChange,
                            t.shareOptionLargeMeals,
                        ].map(opt => {
                            const active = (exp.harder || []).includes(opt);
                            return <button key={opt} onClick={() => toggleExp('harder', opt)} style={chip(active, theme.coral)}>{active ? '✓ ' : ''}{opt}</button>;
                        })}
                    </div>
                </GlassCard>

                <GlassCard style={{ padding: 18, marginBottom: 24 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: theme.amber, marginBottom: 8 }}>
                        ✨ {t.shareWishLabel}
                    </div>
                    <textarea
                        value={exp.wisdom_snippet || ''}
                        onChange={e => setExp(p => ({ ...p, wisdom_snippet: e.target.value }))}
                        placeholder={t.shareWishPlaceholder}
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
                    {loading ? t.saving : t.saveBtn}
                </button>
                <button onClick={onBack} disabled={loading} style={{
                    width: '100%', background: 'transparent',
                    border: `1px solid ${theme.border}`, borderRadius: 12,
                    padding: '10px', color: theme.textMuted, cursor: 'pointer', fontSize: 13,
                }}>← {t.gestureBackTriggers}</button>
            </div>
        </div>
    );
}


const FLOW_STEPS = [
    { id: 'pick_mode', short: '1', labelKey: 'gestureStepPickMode' },
    { id: 'log', short: '2', labelKey: 'gestureStepLog' },
    { id: 'triggers', short: '3', labelKey: 'gestureStepTriggers' },
    { id: 'context', short: '4', labelKey: 'gestureStepContext' },
    { id: 'done', short: '5', labelKey: 'gestureStepDone' },
];

function FlowShell({ patient, phase, title, subtitle, accent = theme.teal, children }) {
    const { t } = useLang();
    const activeIndex = FLOW_STEPS.findIndex((step) => step.id === phase);

    return (
        <div style={{
            minHeight: '100vh',
            padding: '28px 20px 56px',
            fontFamily: "'Inter',sans-serif",
            color: theme.text,
            background: `
                radial-gradient(circle at top left, rgba(95,179,162,0.08), transparent 34%),
                radial-gradient(circle at top right, rgba(244,183,64,0.06), transparent 32%)
            `,
        }}>
            <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                <div style={{
                    marginBottom: 24,
                    padding: '24px 26px',
                    borderRadius: 24,
                    background: `
                        radial-gradient(circle at top right, ${accent}20, transparent 34%),
                        linear-gradient(180deg, rgba(17,24,39,0.9), rgba(15,23,42,0.82))
                    `,
                    border: `1px solid ${theme.border}`,
                    boxShadow: theme.shadowFloat,
                }}>
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 16,
                    }}>
                        <div style={{ maxWidth: 640 }}>
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '6px 10px',
                                borderRadius: 999,
                                marginBottom: 12,
                                background: 'rgba(143,163,184,0.08)',
                                border: `1px solid ${theme.borderSoft}`,
                                color: theme.textMuted,
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                            }}>
                                {t.gestureEasyTitle}
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 6, letterSpacing: '-0.03em' }}>{title}</div>
                            <div style={{ color: theme.textMuted, fontSize: 14, lineHeight: 1.6 }}>{subtitle}</div>
                        </div>

                        <div style={{
                            display: 'grid',
                            gap: 8,
                            minWidth: 240,
                            padding: '14px 16px',
                            borderRadius: 18,
                            background: 'rgba(15,23,42,0.5)',
                            border: `1px solid ${theme.border}`,
                        }}>
                            <div style={{ fontSize: 11, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                                {t.gestureCurrentPatient}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{patient?.id}</div>
                            <div style={{ fontSize: 12, color: accent, fontWeight: 700 }}>{patient?.disease}</div>
                        </div>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: 10,
                        marginTop: 18,
                    }}>
                        {FLOW_STEPS.map((step, index) => {
                            const isActive = index === activeIndex;
                            const isDone = activeIndex > index;
                            const stepColor = isActive ? accent : isDone ? theme.primary : theme.textMuted;
                            return (
                                <div key={step.id} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '10px 12px',
                                    borderRadius: 14,
                                    background: isActive ? `${accent}14` : isDone ? theme.primaryBg : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${isActive ? `${accent}55` : isDone ? `${theme.primary}55` : theme.border}`,
                                }}>
                                    <div style={{
                                        width: 26,
                                        height: 26,
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 12,
                                        fontWeight: 800,
                                        color: '#fff',
                                        background: isDone ? theme.primary : stepColor,
                                        flexShrink: 0,
                                    }}>
                                        {isDone ? '✓' : step.short}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: stepColor }}>{t[step.labelKey]}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {children}
            </div>
        </div>
    );
}



// ══════════════════════════════════════════════════════════════════════════════
// Main GestureInput page
// ══════════════════════════════════════════════════════════════════════════════
export default function GestureInput({ patient }) {
    const { t } = useLang();
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
    const localizedModes = GESTURE_MODES.map((mode) => ({
        ...mode,
        label: t.gestureModes?.[mode.id]?.label || mode.id,
        desc: t.gestureModes?.[mode.id]?.desc || '',
    }));

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
        } catch (e) { setResult({ ok: false, msg: e.response?.data?.detail || t.gestureSubmitFailed }); }
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
            case 'dial': return <DialMode        {...props} />;
            case 'tap_rhythm': return <TapRhythmMode {...props} stepKey={currentSym} />;
            default: return null;
        }
    };

    // Phase: pick mode
    if (phase === 'pick_mode') return (
        <FlowShell
            patient={patient}
            phase={phase}
            title={t.gesturePickTitle}
            subtitle={t.gesturePickSub}
        >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
                {localizedModes.map((m, index) => (
                    <GlassCard key={m.id} style={{
                        transition: 'all 0.2s',
                        position: 'relative',
                        overflow: 'hidden',
                        minHeight: 220,
                        background: `
                            radial-gradient(circle at top right, ${index === 0 ? 'rgba(95,179,162,0.14)' : 'rgba(143,163,184,0.08)'}, transparent 38%),
                            linear-gradient(180deg, rgba(17,24,39,0.86), rgba(15,23,42,0.74))
                        `,
                    }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = theme.shadowFloat; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 20px 60px rgba(0,0,0,0.5)'; }}>
                        <button onClick={() => { setMode(m.id); setPhase('log'); setSymIdx(0); setCurrentVal(5); }}
                            style={{ width: '100%', height: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '20px', textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                                <div style={{ fontSize: 32 }}>{m.icon}</div>
                                {m.id === 'camera_hand' && (
                                    <div style={{
                                        fontSize: 10,
                                        padding: '5px 8px',
                                        borderRadius: 999,
                                        background: theme.tealBg,
                                        border: `1px solid ${theme.borderGlow}`,
                                        color: theme.tealSoft,
                                        fontWeight: 800,
                                        letterSpacing: '0.05em',
                                        textTransform: 'uppercase',
                                    }}>
                                        {t.gestureRecommended}
                                    </div>
                                )}
                            </div>
                            <div style={{ marginTop: 18, fontWeight: 800, fontSize: 16, color: theme.text }}>{m.label}</div>
                            <div style={{ marginTop: 8, color: theme.textMuted, fontSize: 13, lineHeight: 1.65 }}>{m.desc}</div>
                            <div style={{
                                marginTop: 'auto',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                paddingTop: 18,
                                color: m.id === 'camera_hand' ? theme.tealSoft : theme.textSoft,
                                fontSize: 12,
                                fontWeight: 700,
                            }}>
                                {t.gestureStartMode}
                                <span style={{ opacity: 0.8 }}>→</span>
                            </div>
                        </button>
                    </GlassCard>
                ))}
            </div>
        </FlowShell>
    );

    // Phase: log symptoms
    if (phase === 'log') return (
        <FlowShell
            patient={patient}
            phase={phase}
            title={t.gestureLogTitle}
            subtitle={t.gestureLogSub}
            accent={sevColor(currentVal)}
        >
            <div style={{ maxWidth: 920, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(220px, 260px) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
                <GlassCard style={{ padding: 22 }}>
                    <div style={{ fontSize: 11, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 12 }}>
                        {t.gestureSession}
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 999, background: `${sevColor(currentVal)}14`, color: sevColor(currentVal), fontSize: 12, fontWeight: 700, marginBottom: 18 }}>
                        {localizedModes.find((m) => m.id === mode)?.icon} {localizedModes.find((m) => m.id === mode)?.label}
                    </div>
                    <ProgressArc current={symIdx} total={symList.length} />
                    <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.6 }}>
                        {t.gestureSessionHelp}
                    </div>
                    <button onClick={reset} style={{ marginTop: 18, width: '100%', background: 'transparent', border: `1px solid ${theme.border}`, borderRadius: 10, padding: '10px 12px', color: theme.textMuted, cursor: 'pointer', fontSize: 13 }}>
                        ← {t.gestureChangeMode}
                    </button>
                </GlassCard>

                <GlassCard style={{ padding: 28 }}>
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                        <div style={{ color: theme.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{t.gestureHowSevere}</div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: theme.text, marginBottom: 16, letterSpacing: '-0.03em' }}>{fmtSym(currentSym || '')}</div>
                        <div style={{ display: 'flex', justifyContent: 'center' }}><SeverityRing value={currentVal} /></div>
                        <div style={{ marginTop: 10, color: sevColor(currentVal), fontWeight: 800, fontSize: 14 }}>{sevLabel(currentVal, t.gestureSeverityLabels || SEV_LABELS)}</div>
                    </div>
                    {renderMode()}
                    {symIdx > 0 && (
                        <button onClick={() => setSymIdx(i => i - 1)} style={{ marginTop: 18, background: 'transparent', border: `1px solid ${theme.border}`, borderRadius: 10, padding: '8px 18px', color: theme.textMuted, cursor: 'pointer', fontSize: 13 }}>
                            ← {t.gestureBackSymptom}
                        </button>
                    )}
                </GlassCard>
            </div>
        </FlowShell>
    );

    // Phase: triggers
    if (phase === 'triggers') return (
        <FlowShell
            patient={patient}
            phase={phase}
            title={t.gestureStepTriggers}
            subtitle={t.gestureTriggerHint}
            accent={theme.amber}
        >
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
                <GlassCard style={{ padding: 28 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>✅ {t.gestureTriggersTitle}</div>
                    <div style={{ color: theme.textMuted, fontSize: 14, marginBottom: 24 }}>{t.gestureTriggersSubCount(Object.keys(symptoms).length)}</div>
                    <TriggerSelector triggers={config?.triggers || []} selected={selectedTriggers} onToggle={toggleTrigger} />
                    <button onClick={() => setPhase('context')} style={{ marginTop: 24, width: '100%', padding: '14px', background: `linear-gradient(135deg,${theme.primary},${theme.primaryDeep})`, border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                        {t.gestureNextContext} ⚡
                    </button>
                    <button onClick={() => submit({}, {})} disabled={loading} style={{ marginTop: 10, width: '100%', background: 'transparent', border: `1px solid ${theme.border}`, borderRadius: 12, padding: '10px', color: theme.textMuted, cursor: 'pointer', fontSize: 13 }}>
                        {loading ? t.saving : t.gestureSkipSave}
                    </button>
                    <button onClick={() => setPhase('log')} style={{ marginTop: 8, width: '100%', background: 'transparent', border: `1px solid ${theme.border}22`, borderRadius: 12, padding: '8px', color: theme.textMuted, cursor: 'pointer', fontSize: 12 }}>← {t.gestureReviewSymptoms}</button>
                </GlassCard>
            </div>
        </FlowShell>
    );

    // Phase: context (Things That May Have Affected Today + Shared Experience)
    if (phase === 'context') return (
        <FlowShell
            patient={patient}
            phase={phase}
            title={t.gestureContextTitle}
            subtitle={t.gestureContextSub}
            accent={theme.primary}
        >
            <div style={{ maxWidth: 760, margin: '0 auto' }}>
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
        </FlowShell>
    );

    // Phase: done
    if (phase === 'done') return (
        <FlowShell
            patient={patient}
            phase={phase}
            title={result?.ok ? t.gestureDoneSuccessTitle : t.gestureDoneErrorTitle}
            subtitle={result?.ok ? t.gestureDoneSuccessSub : t.gestureDoneErrorSub}
            accent={result?.ok ? theme.primary : theme.coral}
        >
            <GlassCard style={{ padding: 40, textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
                <div style={{ fontSize: 60, marginBottom: 16 }}>{result?.ok ? '🎉' : '⚠'}</div>
                <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: result?.ok ? theme.primary : theme.coral }}>{result?.ok ? t.gestureDoneSaved : t.saveError}</div>
                <div style={{ color: theme.textMuted, fontSize: 14, marginBottom: 8 }}>{result?.ok ? t.gestureDoneSavedDetail : result?.msg}</div>
                {result?.ok && <div style={{ fontSize: 12, color: theme.teal, marginBottom: 20 }}>✅ {t.gestureDoneCurrent}</div>}
                <button onClick={reset} style={{ padding: '12px 32px', background: `linear-gradient(135deg,${theme.teal},${theme.primary})`, border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>{t.gestureDoneLogAnother}</button>
            </GlassCard>
        </FlowShell>
    );

    return (
        <FlowShell
            patient={patient}
            phase={phase}
            title={t.gesturePreparingTitle}
            subtitle={t.gesturePreparingSub}
        >
            <div style={{ color: theme.textMuted }}>{t.gestureLoadingConfig}</div>
        </FlowShell>
    );
}
