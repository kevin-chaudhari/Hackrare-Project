// src/pages/HPOClusterView.js
// Full 3D canvas-based HPO cluster visualization.
// - Single unified canvas: 22 disease super-nodes, each with HPO satellite nodes
// - True 3D perspective projection with depth-based scale + opacity + blur
// - Mouse-wheel zoom, click+drag pan
// - Click any node to inspect it in the side panel
// - Animated floating/breathing effect on all nodes
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { matchHPO } from '../api';

// ── Color palette ─────────────────────────────────────────────────────────────
const PALETTE = {
    ENS: '#f59e0b', EDS: '#3fb950', POTS: '#58a6ff', Heterotaxy: '#f85149',
    PCD: '#a78bfa', FMF: '#fb7185', CF: '#38bdf8', HD: '#c084fc',
    RTT: '#34d399', MFS: '#60a5fa', SMA: '#9ca3af', FXS: '#e879f9',
    NF1: '#a3e635', PKU: '#7dd3fc', WD: '#fcd34d', Pompe: '#d1d5db',
    TS: '#fca5a5', Gaucher: '#6ee7b7', Alkaptonuria: '#e5e7eb',
    Achondroplasia: '#93c5fd', RRP: '#f87171', PRION: '#a8a29e',
};

// ── HPO data per disease ──────────────────────────────────────────────────────
const HPO_DATA = {
    ENS: [
        { key: 'nasal_dryness', id: 'HP:0031458', label: 'Nasal Dryness' },
        { key: 'crusting', id: 'HP:0012366', label: 'Nasal Crusting' },
        { key: 'paradoxical_obstruction', id: 'HP:0002107', label: 'Nasal Obstruction' },
        { key: 'phantom_sensation', id: 'HP:0000229', label: 'Phantom Sensation' },
        { key: 'anxiety', id: 'HP:0000739', label: 'Anxiety' },
        { key: 'depression', id: 'HP:0000716', label: 'Depression' },
        { key: 'sleep_quality', id: 'HP:0001928', label: 'Sleep Disturbance' },
        { key: 'fatigue', id: 'HP:0012378', label: 'Fatigue' },
        { key: 'pain', id: 'HP:0012531', label: 'Pain' },
    ],
    EDS: [
        { key: 'joint_pain', id: 'HP:0002829', label: 'Joint Pain' },
        { key: 'fatigue', id: 'HP:0012378', label: 'Fatigue' },
        { key: 'skin_fragility', id: 'HP:0001942', label: 'Skin Fragility' },
        { key: 'proprioception_loss', id: 'HP:0002084', label: 'Proprioception Loss' },
        { key: 'subluxation', id: 'HP:0001373', label: 'Joint Subluxation' },
        { key: 'gi_symptoms', id: 'HP:0002014', label: 'GI Symptoms' },
        { key: 'pots_symptoms', id: 'HP:0001278', label: 'Orthostatic Hypotension' },
        { key: 'brain_fog', id: 'HP:0100543', label: 'Cognitive Dysfunction' },
        { key: 'anxiety', id: 'HP:0000739', label: 'Anxiety' },
    ],
    POTS: [
        { key: 'palpitations', id: 'HP:0001962', label: 'Palpitations' },
        { key: 'dizziness', id: 'HP:0002321', label: 'Dizziness' },
        { key: 'syncope', id: 'HP:0007183', label: 'Syncope' },
        { key: 'fatigue', id: 'HP:0012378', label: 'Fatigue' },
        { key: 'brain_fog', id: 'HP:0100543', label: 'Brain Fog' },
        { key: 'tremor', id: 'HP:0025406', label: 'Tremor' },
        { key: 'anxiety', id: 'HP:0000739', label: 'Anxiety' },
        { key: 'headache', id: 'HP:0002315', label: 'Headache' },
    ],
    Heterotaxy: [
        { key: 'breathlessness', id: 'HP:0002094', label: 'Dyspnea' },
        { key: 'heart_failure', id: 'HP:0001635', label: 'Heart Failure' },
        { key: 'fatigue', id: 'HP:0012378', label: 'Fatigue' },
        { key: 'edema', id: 'HP:0001629', label: 'VSD' },
        { key: 'cyanosis', id: 'HP:0001653', label: 'Mitral Regurgitation' },
        { key: 'polysplenia', id: 'HP:0001748', label: 'Polysplenia' },
    ],
    PCD: [
        { key: 'cough', id: 'HP:0002110', label: 'Cough' },
        { key: 'sinusitis', id: 'HP:0005621', label: 'Recurrent Sinusitis' },
        { key: 'breathlessness', id: 'HP:0002099', label: 'Asthma' },
        { key: 'fatigue', id: 'HP:0012378', label: 'Fatigue' },
        { key: 'mucociliary', id: 'HP:0012179', label: 'Mucociliary Defect' },
    ],
    FMF: [
        { key: 'fever', id: 'HP:0001945', label: 'Fever' },
        { key: 'peritonitis', id: 'HP:0001744b', label: 'Peritonitis' },
        { key: 'joint_pain', id: 'HP:0002829', label: 'Joint Pain' },
        { key: 'serositis', id: 'HP:0001744', label: 'Serositis' },
        { key: 'fatigue', id: 'HP:0012378', label: 'Fatigue' },
    ],
    CF: [
        { key: 'cough', id: 'HP:0002110', label: 'Cough' },
        { key: 'breathlessness', id: 'HP:0002094', label: 'Breathlessness' },
        { key: 'lung_infection', id: 'HP:0006528', label: 'Lung Infection' },
        { key: 'malnutrition', id: 'HP:0001410', label: 'Malnutrition' },
        { key: 'fatigue', id: 'HP:0012378', label: 'Fatigue' },
        { key: 'clubbing', id: 'HP:0003126', label: 'Clubbing' },
    ],
    HD: [
        { key: 'chorea', id: 'HP:0001336', label: 'Chorea' },
        { key: 'memory', id: 'HP:0002354', label: 'Memory Impairment' },
        { key: 'apathy', id: 'HP:0000741', label: 'Apathy' },
        { key: 'depression', id: 'HP:0000716', label: 'Depression' },
        { key: 'parkinsonism', id: 'HP:0001300', label: 'Parkinsonism' },
        { key: 'dementia', id: 'HP:0000726', label: 'Dementia' },
    ],
    RTT: [
        { key: 'hand_stereotypy', id: 'HP:0001336b', label: 'Hand Stereotypy' },
        { key: 'social_withdrawal', id: 'HP:0000735', label: 'Social Withdrawal' },
        { key: 'seizures', id: 'HP:0001250', label: 'Seizures' },
        { key: 'breathing', id: 'HP:0000739b', label: 'Breathing Irregularity' },
        { key: 'gait', id: 'HP:0001288', label: 'Gait Disturbance' },
        { key: 'regression', id: 'HP:0007272', label: 'Neurological Regression' },
    ],
    MFS: [
        { key: 'aortic_dilation', id: 'HP:0001649', label: 'Aortic Dilation' },
        { key: 'scoliosis', id: 'HP:0002650', label: 'Scoliosis' },
        { key: 'myopia', id: 'HP:0000545', label: 'Myopia' },
        { key: 'palpitations', id: 'HP:0001962', label: 'Palpitations' },
        { key: 'marfanoid', id: 'HP:0001519', label: 'Marfanoid Habitus' },
        { key: 'lens', id: 'HP:0001001', label: 'Lens Dislocation' },
    ],
    SMA: [
        { key: 'muscle_weakness', id: 'HP:0003202', label: 'Muscle Weakness' },
        { key: 'hypotonia', id: 'HP:0001265', label: 'Hypotonia' },
        { key: 'breathing', id: 'HP:0002871', label: 'Diaphragmatic Paralysis' },
        { key: 'proximal', id: 'HP:0001290', label: 'Proximal Weakness' },
        { key: 'fatigue', id: 'HP:0012378', label: 'Fatigue' },
    ],
    FXS: [
        { key: 'hyperactivity', id: 'HP:0000752b', label: 'Hyperactivity' },
        { key: 'dev_delay', id: 'HP:0001263', label: 'Global Dev. Delay' },
        { key: 'anxiety', id: 'HP:0000739', label: 'Anxiety' },
        { key: 'aggression', id: 'HP:0000718', label: 'Aggression' },
        { key: 'hypotonia', id: 'HP:0001252', label: 'Hypotonia' },
    ],
    NF1: [
        { key: 'cafe_spots', id: 'HP:0009735', label: 'Cafe-au-lait Spots' },
        { key: 'neurofibromas', id: 'HP:0001067', label: 'Neurofibromas' },
        { key: 'vision', id: 'HP:0000572', label: 'Visual Loss' },
        { key: 'learning', id: 'HP:0002650b', label: 'Learning Disability' },
        { key: 'pain', id: 'HP:0012531', label: 'Pain' },
    ],
    PKU: [
        { key: 'cognitive', id: 'HP:0001256', label: 'Intellectual Disability' },
        { key: 'behavioral', id: 'HP:0000708', label: 'Behavioral Abnormality' },
        { key: 'dev_delay', id: 'HP:0001263b', label: 'Developmental Delay' },
        { key: 'anxiety', id: 'HP:0000739', label: 'Anxiety' },
        { key: 'fatigue', id: 'HP:0012378', label: 'Fatigue' },
    ],
    WD: [
        { key: 'tremor', id: 'HP:0025406', label: 'Tremor' },
        { key: 'dysarthria', id: 'HP:0002307', label: 'Dysarthria' },
        { key: 'dystonia', id: 'HP:0001332', label: 'Dystonia' },
        { key: 'hepatic', id: 'HP:0001397', label: 'Hepatic Steatosis' },
        { key: 'anemia', id: 'HP:0001903', label: 'Anemia' },
        { key: 'cognitive', id: 'HP:0100543', label: 'Cognitive Dysfunction' },
    ],
    Pompe: [
        { key: 'muscle_weakness', id: 'HP:0003202b', label: 'Muscle Weakness' },
        { key: 'breathing', id: 'HP:0002093', label: 'Respiratory Failure' },
        { key: 'cramps', id: 'HP:0001324', label: 'Muscle Cramps' },
        { key: 'cardiomyopathy', id: 'HP:0001637', label: 'Cardiomyopathy' },
        { key: 'fatigue', id: 'HP:0012378', label: 'Fatigue' },
    ],
    TS: [
        { key: 'seizures', id: 'HP:0001250b', label: 'Epileptic Seizures' },
        { key: 'regression', id: 'HP:0001256b', label: 'Dev. Regression' },
        { key: 'neurodegeneration', id: 'HP:0001336c', label: 'Neurodegeneration' },
        { key: 'cherry_spot', id: 'HP:0001250', label: 'Seizures' },
        { key: 'hypotonia', id: 'HP:0001265', label: 'Hypotonia' },
    ],
    Gaucher: [
        { key: 'bone_pain', id: 'HP:0002653', label: 'Bone Pain' },
        { key: 'fatigue', id: 'HP:0012378', label: 'Fatigue' },
        { key: 'hepatomegaly', id: 'HP:0002240', label: 'Hepatomegaly' },
        { key: 'thrombocytopenia', id: 'HP:0001744d', label: 'Thrombocytopenia' },
        { key: 'anemia', id: 'HP:0001903', label: 'Anemia' },
    ],
    Alkaptonuria: [
        { key: 'joint_pain', id: 'HP:0004430', label: 'Degenerative Joint Disease' },
        { key: 'pigmentation', id: 'HP:0002926', label: 'Ochronotic Pigmentation' },
        { key: 'cardiac', id: 'HP:0001337', label: 'Cardiac Valve Disease' },
        { key: 'back_pain', id: 'HP:0002829', label: 'Joint Pain' },
        { key: 'fatigue', id: 'HP:0012378', label: 'Fatigue' },
    ],
    Achondroplasia: [
        { key: 'scoliosis', id: 'HP:0002650', label: 'Scoliosis' },
        { key: 'macrocephaly', id: 'HP:0000256', label: 'Macrocephaly' },
        { key: 'short_limbs', id: 'HP:0002673', label: 'Short Limbs' },
        { key: 'hearing', id: 'HP:0001250c', label: 'Hearing Loss' },
        { key: 'fatigue', id: 'HP:0012378', label: 'Fatigue' },
    ],
    RRP: [
        { key: 'hoarseness', id: 'HP:0001620', label: 'Hoarseness' },
        { key: 'stridor', id: 'HP:0002093b', label: 'Stridor' },
        { key: 'papillomas', id: 'HP:0000961', label: 'Laryngeal Papillomas' },
        { key: 'breathing', id: 'HP:0002094', label: 'Breathlessness' },
        { key: 'fatigue', id: 'HP:0012378', label: 'Fatigue' },
    ],
    PRION: [
        { key: 'cognitive', id: 'HP:0001300b', label: 'Rapid Neurological Decline' },
        { key: 'gait', id: 'HP:0001288', label: 'Gait Disturbance' },
        { key: 'dementia', id: 'HP:0000726', label: 'Dementia' },
        { key: 'myoclonus', id: 'HP:0002352', label: 'Spongiform Changes' },
        { key: 'dysarthria', id: 'HP:0001260', label: 'Dysarthria' },
    ],
};

const DISEASES = Object.keys(PALETTE);

// ── Build 3D node graph ────────────────────────────────────────────────────────
function buildGraph() {
    const nodes = [];
    const edges = [];
    const N = DISEASES.length;

    // Disease super-nodes on a large sphere
    DISEASES.forEach((d, i) => {
        const phi = Math.acos(1 - (2 * i) / N);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;
        const R = 380;
        nodes.push({
            id: `disease_${d}`,
            kind: 'disease',
            disease: d,
            label: d,
            x: R * Math.sin(phi) * Math.cos(theta),
            y: R * Math.sin(phi) * Math.sin(theta),
            z: R * Math.cos(phi),
            r: 22,
            color: PALETTE[d],
        });

        // HPO satellite nodes around each disease
        const hpos = HPO_DATA[d] || [];
        hpos.forEach((h, j) => {
            const a = (2 * Math.PI * j) / hpos.length;
            const orbitR = 90 + Math.random() * 10;
            const tilt = (i / N) * Math.PI;
            const hx = nodes[i].x + orbitR * Math.cos(a) * Math.cos(tilt);
            const hy = nodes[i].y + orbitR * Math.sin(a);
            const hz = nodes[i].z + orbitR * Math.cos(a) * Math.sin(tilt);
            const nid = `hpo_${d}_${j}`;
            nodes.push({
                id: nid,
                kind: 'hpo',
                disease: d,
                label: h.label,
                hpo_id: h.id,
                key: h.key,
                x: hx, y: hy, z: hz,
                r: 9,
                color: PALETTE[d],
            });
            edges.push({ from: `disease_${d}`, to: nid, color: PALETTE[d] });
        });
    });

    return { nodes, edges };
}

const GRAPH = buildGraph();

// ── 3D → 2D perspective projection ───────────────────────────────────────────
function project(x, y, z, camZ, cx, cy, scale) {
    const fov = 900;
    const sz = fov / (fov + z - camZ);
    return {
        sx: cx + x * sz * scale,
        sy: cy + y * sz * scale,
        scale: sz,
        depth: z,
    };
}

// ── Main component ────────────────────────────────────────────────────────────
export default function HPOClusterView() {
    const canvasRef = useRef(null);
    const stateRef = useRef({
        zoom: 1.0,
        offsetX: 0,
        offsetY: 0,
        rotX: 0.2,
        rotY: 0,
        dragging: false,
        lastMX: 0,
        lastMY: 0,
        tick: 0,
        hoveredId: null,
    });
    const [selected, setSelected] = useState(null);
    const [matches, setMatches] = useState(null);
    const [loadingMatch, setLoadingMatch] = useState(false);
    const animRef = useRef(null);

    // Rotate point by rotX, rotY
    function rotate3D(x, y, z, rx, ry) {
        // Y rotation
        const cosY = Math.cos(ry), sinY = Math.sin(ry);
        let x1 = x * cosY - z * sinY;
        let z1 = x * sinY + z * cosY;
        // X rotation
        const cosX = Math.cos(rx), sinX = Math.sin(rx);
        let y2 = y * cosX - z1 * sinX;
        let z2 = y * sinX + z1 * cosX;
        return { x: x1, y: y2, z: z2 };
    }

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const st = stateRef.current;
        st.tick++;

        ctx.clearRect(0, 0, W, H);

        // ── Starfield background ────────────────────────────────────────────────
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, W, H);

        // Static stars
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        for (let i = 0; i < 120; i++) {
            const sx = ((i * 137 + 17) % W);
            const sy = ((i * 241 + 53) % H);
            const sr = (i % 3 === 0) ? 1.2 : 0.6;
            ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
        }

        const cx = W / 2 + st.offsetX;
        const cy = H / 2 + st.offsetY;
        const camZ = -1200;

        // Auto-slow rotation when not dragging
        if (!st.dragging) {
            st.rotY += 0.0025;
        }

        // Breathing animation offset
        const breathe = Math.sin(st.tick * 0.04) * 4;

        // Project all nodes
        const projected = GRAPH.nodes.map((n, i) => {
            // Subtle per-node float
            const fw = Math.sin(st.tick * 0.03 + i * 0.7) * 3;
            const fh = Math.cos(st.tick * 0.025 + i * 1.1) * 3;
            const r = rotate3D(n.x, n.y + fw + breathe, n.z + fh, st.rotX, st.rotY);
            const p = project(r.x, r.y, r.z, camZ, cx, cy, st.zoom);
            return { ...n, ...p, rotated: r };
        });

        // Sort back-to-front (painter's algorithm)
        projected.sort((a, b) => a.depth - b.depth);

        // Build an id→projected map for edge drawing
        const projMap = {};
        projected.forEach(p => { projMap[p.id] = p; });

        // ── Draw edges ──────────────────────────────────────────────────────────
        GRAPH.edges.forEach(e => {
            const a = projMap[e.from], b = projMap[e.to];
            if (!a || !b) return;
            const opacity = Math.max(0.04, Math.min(0.35, (a.scale + b.scale) / 4));
            ctx.beginPath();
            ctx.moveTo(a.sx, a.sy);
            ctx.lineTo(b.sx, b.sy);
            ctx.strokeStyle = e.color + Math.round(opacity * 255).toString(16).padStart(2, '0');
            ctx.lineWidth = 0.8 * ((a.scale + b.scale) / 2) * st.zoom;
            ctx.stroke();
        });

        // ── Draw nodes ──────────────────────────────────────────────────────────
        projected.forEach(n => {
            const isHovered = st.hoveredId === n.id;
            const isSelected = selected?.id === n.id;
            const isDisease = n.kind === 'disease';
            const depth = (n.scale);
            const opacity = Math.max(0.18, Math.min(1.0, depth * 1.6));
            const r = n.r * n.scale * st.zoom * (isHovered ? 1.35 : isSelected ? 1.5 : 1);

            ctx.save();
            ctx.globalAlpha = opacity;

            if (isDisease) {
                // Outer glow ring
                const grd = ctx.createRadialGradient(n.sx, n.sy, r * 0.3, n.sx, n.sy, r * 2.5);
                grd.addColorStop(0, n.color + 'aa');
                grd.addColorStop(0.5, n.color + '33');
                grd.addColorStop(1, 'transparent');
                ctx.beginPath();
                ctx.arc(n.sx, n.sy, r * 2.5, 0, Math.PI * 2);
                ctx.fillStyle = grd;
                ctx.fill();

                // 3D sphere gradient
                const sphereGrd = ctx.createRadialGradient(
                    n.sx - r * 0.4, n.sy - r * 0.4, r * 0.05,
                    n.sx, n.sy, r
                );
                sphereGrd.addColorStop(0, '#ffffff55');
                sphereGrd.addColorStop(0.3, n.color + 'ee');
                sphereGrd.addColorStop(1, n.color + '44');
                ctx.beginPath();
                ctx.arc(n.sx, n.sy, r, 0, Math.PI * 2);
                ctx.fillStyle = sphereGrd;
                ctx.fill();

                // Border
                ctx.beginPath();
                ctx.arc(n.sx, n.sy, r, 0, Math.PI * 2);
                ctx.strokeStyle = isHovered || isSelected ? '#ffffff' : n.color;
                ctx.lineWidth = isSelected ? 3 : 1.5;
                ctx.stroke();

                // Disease label
                ctx.globalAlpha = opacity * (isHovered ? 1 : 0.85);
                ctx.fillStyle = '#ffffff';
                ctx.font = `bold ${Math.max(9, 11 * n.scale * st.zoom)}px 'Inter', sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(n.label, n.sx, n.sy);

                // HPO count badge below disease
                ctx.globalAlpha = opacity * 0.5;
                ctx.font = `${Math.max(7, 8.5 * n.scale * st.zoom)}px 'Inter', sans-serif`;
                ctx.fillStyle = n.color;
                ctx.fillText(`${(HPO_DATA[n.disease] || []).length} HPO`, n.sx, n.sy + r + 10 * n.scale);
            } else {
                // HPO satellite nodes — smaller spheres
                const sphereGrd = ctx.createRadialGradient(
                    n.sx - r * 0.35, n.sy - r * 0.35, r * 0.05,
                    n.sx, n.sy, r
                );
                sphereGrd.addColorStop(0, '#ffffff44');
                sphereGrd.addColorStop(0.4, n.color + 'cc');
                sphereGrd.addColorStop(1, n.color + '22');
                ctx.beginPath();
                ctx.arc(n.sx, n.sy, r, 0, Math.PI * 2);
                ctx.fillStyle = sphereGrd;
                ctx.fill();

                if (isHovered || isSelected) {
                    ctx.beginPath();
                    ctx.arc(n.sx, n.sy, r, 0, Math.PI * 2);
                    ctx.strokeStyle = isSelected ? '#ffffff' : n.color;
                    ctx.lineWidth = isSelected ? 2 : 1;
                    ctx.stroke();
                    // Label on hover
                    ctx.globalAlpha = opacity;
                    ctx.fillStyle = '#e6edf3';
                    ctx.font = `${Math.max(7.5, 9 * n.scale * st.zoom)}px 'Inter', sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillText(n.label, n.sx, n.sy + r + 3);
                }
            }
            ctx.restore();
        });

        // ── Draw info overlay (zoom level) ─────────────────────────────────────
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#8b949e';
        ctx.font = '11px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`zoom ${(st.zoom * 100).toFixed(0)}%`, W - 16, H - 16);
        ctx.restore();
    }, [selected]);

    // ── Render loop ─────────────────────────────────────────────────────────────
    useEffect(() => {
        const loop = () => {
            draw();
            animRef.current = requestAnimationFrame(loop);
        };
        animRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animRef.current);
    }, [draw]);

    // ── Resize canvas ────────────────────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        const resize = () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        };
        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);

    // ── Hit test ─────────────────────────────────────────────────────────────────
    function hitTest(mx, my) {
        const canvas = canvasRef.current;
        const st = stateRef.current;
        const W = canvas.width, H = canvas.height;
        const cx = W / 2 + st.offsetX;
        const cy = H / 2 + st.offsetY;
        const camZ = -1200;
        let best = null, bestDist = Infinity;
        GRAPH.nodes.forEach((n, i) => {
            const r = rotate3D(n.x, n.y, n.z, st.rotX, st.rotY);
            const p = project(r.x, r.y, r.z, camZ, cx, cy, st.zoom);
            const hitR = n.r * p.scale * st.zoom * 1.8;
            const d = Math.hypot(p.sx - mx, p.sy - my);
            if (d < hitR && d < bestDist) { best = { ...n, ...p }; bestDist = d; }
        });
        return best;
    }

    // ── Mouse events ─────────────────────────────────────────────────────────────
    const onMouseMove = useCallback((e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const st = stateRef.current;
        if (st.dragging) {
            const dx = mx - st.lastMX, dy = my - st.lastMY;
            st.rotY += dx * 0.005;
            st.rotX += dy * 0.005;
            st.rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, st.rotX));
        }
        st.lastMX = mx; st.lastMY = my;
        const hit = hitTest(mx, my);
        st.hoveredId = hit ? hit.id : null;
        canvasRef.current.style.cursor = hit ? 'pointer' : 'grab';
    }, []);

    const onMouseDown = useCallback((e) => {
        stateRef.current.dragging = true;
        stateRef.current.lastMX = e.clientX - canvasRef.current.getBoundingClientRect().left;
        stateRef.current.lastMY = e.clientY - canvasRef.current.getBoundingClientRect().top;
    }, []);

    const onMouseUp = useCallback((e) => {
        const st = stateRef.current;
        if (!st.dragging) return;
        st.dragging = false;
        const rect = canvasRef.current.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const hit = hitTest(mx, my);
        if (hit) {
            setSelected(hit);
            if (hit.kind === 'hpo') {
                setMatches(null);
                setLoadingMatch(true);
                matchHPO(hit.label, hit.disease, 5)
                    .then(r => { setMatches(r.data.matches); setLoadingMatch(false); })
                    .catch(() => setLoadingMatch(false));
            } else { setMatches(null); }
        }
    }, []);

    const onWheel = useCallback((e) => {
        e.preventDefault();
        const st = stateRef.current;
        const delta = e.deltaY > 0 ? -0.08 : 0.08;
        st.zoom = Math.max(0.15, Math.min(4.5, st.zoom + delta));
    }, []);

    const onTouchStart = useCallback((e) => {
        if (e.touches.length === 1) {
            const t = e.touches[0];
            stateRef.current.dragging = true;
            stateRef.current.lastMX = t.clientX;
            stateRef.current.lastMY = t.clientY;
        }
    }, []);
    const onTouchMove = useCallback((e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
            const t = e.touches[0];
            const st = stateRef.current;
            const dx = t.clientX - st.lastMX, dy = t.clientY - st.lastMY;
            st.rotY += dx * 0.005; st.rotX += dy * 0.005;
            st.lastMX = t.clientX; st.lastMY = t.clientY;
        }
    }, []);
    const onTouchEnd = useCallback(() => { stateRef.current.dragging = false; }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 90px)', gap: 0 }}>
            {/* Header */}
            <div style={{ padding: '0 0 16px' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#e6edf3', letterSpacing: '-0.5px' }}>
                    3D HPO Cluster Universe
                </div>
                <div style={{ fontSize: 13, color: '#484f58', marginTop: 3 }}>
                    22 rare disease clusters · {GRAPH.nodes.length} nodes · Drag to rotate · Scroll to zoom · Click to inspect
                </div>
            </div>

            <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
                {/* ── 3D Canvas ── */}
                <div style={{ flex: 1, borderRadius: 16, overflow: 'hidden', border: '1px solid #21262d', position: 'relative', background: '#0d1117', minHeight: 0 }}>
                    <canvas
                        ref={canvasRef}
                        style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab', userSelect: 'none' }}
                        onMouseMove={onMouseMove}
                        onMouseDown={onMouseDown}
                        onMouseUp={onMouseUp}
                        onMouseLeave={() => { stateRef.current.dragging = false; stateRef.current.hoveredId = null; }}
                        onWheel={onWheel}
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
                    />
                    {/* Controls overlay */}
                    <div style={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', gap: 8 }}>
                        {[['−', -0.3], ['+', 0.3], ['⟳', 0]].map(([lbl, delta]) => (
                            <button key={lbl} onClick={() => {
                                if (lbl === '⟳') { stateRef.current.rotX = 0.2; stateRef.current.rotY = 0; stateRef.current.zoom = 1.0; }
                                else stateRef.current.zoom = Math.max(0.15, Math.min(4.5, stateRef.current.zoom + delta));
                            }} style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid #30363d', background: 'rgba(22,27,34,0.9)', color: '#c9d1d9', fontSize: 16, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {lbl}
                            </button>
                        ))}
                    </div>
                    {/* Legend */}
                    <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', gap: 12, flexWrap: 'wrap', maxWidth: 340 }}>
                        {DISEASES.map(d => (
                            <div key={d} onClick={() => {
                                // Snap view to disease
                                const n = GRAPH.nodes.find(nx => nx.id === `disease_${d}`);
                                if (n) {
                                    const st = stateRef.current;
                                    st.rotY = -Math.atan2(n.x, n.z);
                                    st.rotX = -Math.atan2(n.y, Math.sqrt(n.x * n.x + n.z * n.z));
                                    st.zoom = 1.5;
                                }
                            }} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', padding: '2px 6px', borderRadius: 6, background: `${PALETTE[d]}15` }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: PALETTE[d], boxShadow: `0 0 4px ${PALETTE[d]}` }} />
                                <span style={{ fontSize: 9, color: PALETTE[d], fontWeight: 700 }}>{d}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Inspector Panel ── */}
                <div style={{ width: 300, background: '#161b22', border: '1px solid #21262d', borderRadius: 16, overflow: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                    {!selected ? (
                        <div style={{ padding: 32, color: '#484f58', textAlign: 'center', fontSize: 13, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                            <div style={{ fontSize: 40, opacity: 0.3 }}>🔬</div>
                            <div>Click any node on the 3D cluster to inspect it</div>
                            <div style={{ fontSize: 11, lineHeight: 1.5, color: '#30363d' }}>
                                Large spheres = diseases<br />Small spheres = HPO terms
                            </div>
                        </div>
                    ) : (
                        <div style={{ padding: 20, flex: 1 }}>
                            {/* Node header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #21262d' }}>
                                <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${PALETTE[selected.disease]}22`, border: `2px solid ${PALETTE[selected.disease]}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                                    {selected.kind === 'disease' ? '⬡' : '○'}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: '#e6edf3' }}>{selected.label}</div>
                                    <div style={{ fontSize: 11, color: PALETTE[selected.disease] }}>
                                        {selected.kind === 'disease' ? 'Disease Cluster' : selected.hpo_id}
                                    </div>
                                </div>
                            </div>

                            {selected.kind === 'disease' && (
                                <>
                                    <div style={{ fontSize: 11, color: '#484f58', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>HPO Terms in this cluster</div>
                                    {(HPO_DATA[selected.disease] || []).map((h, i) => (
                                        <div key={i} style={{ display: 'flex', gap: 8, padding: '7px 10px', background: '#0d1117', borderRadius: 8, marginBottom: 5, alignItems: 'center' }}>
                                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: PALETTE[selected.disease], flexShrink: 0 }} />
                                            <div>
                                                <div style={{ fontSize: 12, fontWeight: 600, color: '#c9d1d9' }}>{h.label}</div>
                                                <div style={{ fontSize: 10, color: '#484f58' }}>{h.id}</div>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}

                            {selected.kind === 'hpo' && (
                                <>
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ fontSize: 11, color: '#484f58', marginBottom: 4 }}>Symptom Key</div>
                                        <code style={{ fontSize: 11, color: '#c9d1d9', background: '#21262d', padding: '3px 8px', borderRadius: 6 }}>{selected.key}</code>
                                    </div>
                                    <div style={{ fontSize: 11, color: '#484f58', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>Semantic Neighbors</div>
                                    {loadingMatch && <div style={{ color: '#484f58', fontSize: 12 }}>⏳ Matching HPO terms...</div>}
                                    {matches && matches.map((m, i) => (
                                        <div key={i} style={{ background: '#0d1117', borderRadius: 8, padding: '8px 10px', marginBottom: 6 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ fontSize: 12, fontWeight: 600, color: '#c9d1d9' }}>{m.label}</div>
                                                <div style={{ fontSize: 11, fontWeight: 800, color: PALETTE[selected.disease] }}>{(m.score * 100).toFixed(0)}%</div>
                                            </div>
                                            <div style={{ marginTop: 5, height: 3, borderRadius: 2, background: '#21262d', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${m.score * 100}%`, background: PALETTE[selected.disease], borderRadius: 2, transition: 'width 0.5s' }} />
                                            </div>
                                            <div style={{ fontSize: 9.5, color: '#484f58', marginTop: 3 }}>{m.hpo_id}</div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
