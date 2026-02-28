# RareSignal AI

**Structured Symptom-to-Signal Translation for Rare Disease Care**

> Harvard Rare Disease Hackathon — Symptom Management Track

---

## Overview

RareSignal AI converts patient-reported symptom data into structured, clinician-usable longitudinal signals. It is **not** a diagnostic or treatment tool. It solves the documentation and signal-extraction problem.

**Supported diseases:** POTS, EDS (Ehlers-Danlos), ENS (Empty Nose Syndrome), Heterotaxy Syndrome, Primary Ciliary Dyskinesia

**Core signals computed:**
- Z-score deviation from personalized EWMA baseline
- Volatility Index (rolling std + CV + Approximate Entropy)
- Flare Acceleration (slope + CUSUM change-point detection)
- Trigger Association (Spearman correlation, 1-day lag)
- Functional Impact Score (5 ICF-aligned domains)
- Missingness & Confidence scoring

---

## Project Structure

```
raresignal-ai/
├── backend/
│   ├── __init__.py
│   ├── main.py              # FastAPI app, all endpoints
│   ├── database.py          # SQLAlchemy models, SQLite
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── signal_engine.py     # Core signal computation (math + code)
│   ├── summary_generator.py # Clinician-ready text output
│   └── disease_config.py    # Disease-specific configurations
├── ml/
│   ├── __init__.py
│   ├── lstm_model.py        # PyTorch model (LSTM + Transformer + Fusion)
│   └── train.py             # Training loop + synthetic data generator
├── frontend/
│   ├── package.json
│   └── src/
│       ├── App.js
│       ├── api.js
│       ├── index.js
│       └── pages/
│           ├── PatientSetup.js
│           ├── PatientDashboard.js
│           ├── SignalVisualization.js
│           └── ClinicianView.js
├── requirements.txt
├── seed_demo.py             # Demo data seeder
└── README.md
```

---

## Quick Start (48-Hour Hackathon)

### 1. Create project and install backend

```bash
# Clone / unzip the project, then:
cd raresignal-ai

# Create virtual environment
python3.10 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Run FastAPI backend

```bash
# From raresignal-ai/ directory:
uvicorn backend.main:app --reload --port 8000
```

Backend will be at: http://localhost:8000
API docs (Swagger): http://localhost:8000/docs

### 3. Seed demo data (optional but recommended for demo)

```bash
# In a new terminal, with backend running:
python seed_demo.py
```

This creates 3 demo patients (POTS, EDS, PCD) with 30 days of synthetic symptom data.

### 4. Run frontend

```bash
cd frontend
npm install
npm start
```

Frontend will be at: http://localhost:3000

### 5. Train ML model (optional)

```bash
# From raresignal-ai/ directory:
python -m ml.train --disease POTS --epochs 30 --patients 100
```

---

## API Reference

All endpoints documented at http://localhost:8000/docs

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/patients` | Create patient profile |
| POST | `/entries` | Add symptom entry |
| POST | `/compute-signals` | Compute all 6 signals |
| POST | `/predict-risk` | Risk categorization + 3-day forecast |
| POST | `/generate-summary` | Generate clinician brief |
| GET | `/patients/{id}/history` | Longitudinal signal history |
| GET | `/patients/{id}/baseline` | Current EWMA baseline |
| GET | `/diseases` | List disease configurations |

### Example API Test

```bash
# 1. Create patient
curl -X POST http://localhost:8000/patients \
  -H "Content-Type: application/json" \
  -d '{"id": "patient-test-01", "disease": "POTS"}'

# 2. Add entry
curl -X POST http://localhost:8000/entries \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "patient-test-01",
    "symptoms": {
      "dizziness": 7.5,
      "heart_rate_elevation": 6.0,
      "fatigue": 8.0,
      "brain_fog": 5.5,
      "syncope_nearness": 3.0,
      "nausea": 4.0,
      "exercise_intolerance": 7.0,
      "sleep_quality": 6.5,
      "anxiety": 5.0,
      "gi_symptoms": 3.0
    },
    "triggers": ["dehydration", "heat_exposure"],
    "notes": "Bad day — stood too long"
  }'

# 3. Compute signals
curl -X POST http://localhost:8000/compute-signals \
  -H "Content-Type: application/json" \
  -d '{"patient_id": "patient-test-01", "window_days": 7}'

# 4. Generate summary
curl -X POST http://localhost:8000/generate-summary \
  -H "Content-Type: application/json" \
  -d '{"patient_id": "patient-test-01", "window_days": 7}'

# 5. Predict risk
curl -X POST http://localhost:8000/predict-risk \
  -H "Content-Type: application/json" \
  -d '{"patient_id": "patient-test-01"}'
```

---

## Mathematical Framework

### Baseline Modeling (EWMA)

```
μ_t = α · x_t + (1-α) · μ_{t-1}
σ_t = √(α · (x_t - μ_t)² + (1-α) · σ_{t-1}²)
z(t) = (x(t) - μ_B(t)) / max(σ_B(t), ε)
```

### Volatility Index

```
VI = 0.4·norm(σ_roll) + 0.3·norm(CV) + 0.3·norm(ApEn)
CV = σ_roll / (μ_roll + ε)
ApEn(m, r) = φ_m - φ_{m+1}
```

### Functional Impact Score

```
FIS_domain = Σ_i(w_i · symptom_i / 10)
FIS_composite = Σ_d(W_d · FIS_domain_d)
```

### Risk Categorization (conservative)

| Z_max | VI | Category |
|-------|-----|----------|
| > 3.0 | any | CRITICAL |
| > 2.0 | > 0.7 | CRITICAL |
| > 2.0 | any | HIGH |
| > 1.5 | > 0.5 | HIGH |
| > 1.0 | any | MODERATE |
| ≤ 1.0 | ≤ 0.4 | LOW |

---

## ML Model Architecture

```
Input: [Time-series symptoms (B,T,D)] [Baseline feats (B,3)] [Triggers (B,4)] [Volatility (B,3)] [Disease (B)]
  ↓
Bidirectional LSTM (2 layers, hidden=64) → Transformer Encoder (2 layers, 4 heads)
  ↓
Signal Fusion Layer (hidden*2 + 32 + 32 + 16 + 16 → 256 → 128)
  ↓
[Risk Classifier (4 classes)] [FIS Regressor (5 domains)] [Forecast Head (3 days)]

Loss: 0.5·FocalLoss(risk) + 0.3·HuberLoss(FIS) + 0.2·HuberLoss(forecast)
```

---

## Safety & Guardrails

1. **No diagnostic output** — model has no diagnosis output head
2. **No treatment recommendations** — all text templates reviewed for scope compliance
3. **Conservative risk thresholds** — errs toward over-reporting
4. **Red flag detection** — disease-specific rules override aggregate model
5. **Confidence suppression** — signals suppressed when data completeness < 40%
6. **Explicit scope disclaimer** — every summary includes mandatory disclaimer

---

## Evaluation Plan

### Case Replay Scenarios (in `ml/train.py`)
- Scenario 1: POTS flare with gradual HR elevation + sleep deprivation trigger
- Scenario 2: EDS multi-joint flare with functional mobility impact
- Scenario 3: PCD exacerbation with respiratory signal escalation

### Metrics
- Flare detection F1 (within 48h of onset)
- ECE (Expected Calibration Error) < 0.05
- Signal completeness vs raw notes (target: >85% fields populated)
- Ablation: remove each signal module, measure detection F1 drop

---

## 48-Hour Plan

| Phase | Time | Deliverable |
|-------|------|-------------|
| 1. Data Architecture | 0-3h | SQLite, schemas, disease configs |
| 2. Signal Engine | 3-8h | All 6 signals + unit tests |
| 3. LSTM Model | 8-16h | Architecture + training loop |
| 4. API | 16-22h | All endpoints working |
| 5. Frontend | 22-30h | Input + visualization + clinician view |
| 6. Demo Data | 30-34h | seed_demo.py + 3 scenarios |
| 7. Testing | 34-42h | Replay scenarios + ablations |
| 8. Demo Prep | 42-48h | End-to-end recording + Q&A prep |

---

## Scope Disclaimer

RareSignal AI is a documentation and signal translation tool.
It does **NOT** diagnose, treat, or provide medical advice.
All clinical decisions remain with qualified healthcare providers.
