# main.py — RareSignal AI FastAPI backend
import json
import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.database import init_db, get_db, Patient, SymptomEntry, BaselineProfile, ComputedSignal, FunctionalScore, Alert
from backend.schemas import (
    PatientCreate, PatientResponse,
    SymptomEntryCreate, SymptomEntryResponse,
    SignalRequest, SignalResponse,
    RiskPredictionRequest, RiskPredictionResponse,
    SummaryRequest, ClinicalSummaryResponse,
    DetailedReportRequest, DetailedReportResponse,
    HPOMatchRequest, HPOMatchResponse, HPOMatchResult,
    FlareAlertResponse,
    PatientHistoryResponse, SignalHistoryPoint
)
from backend.signal_engine import (
    compute_all_signals, update_ewma_baseline, initialize_baseline_from_history
)
from backend.summary_generator import generate_structured_summary, generate_detailed_ai_report
from backend.disease_config import DISEASE_CONFIGS
from backend.hpo_matcher import match_symptom, get_disease_hpo_cluster


# ─── App Lifecycle ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    print("RareSignal AI backend started. DB initialized.")
    yield
    print("RareSignal AI backend shutting down.")


app = FastAPI(
    title="RareSignal AI",
    description="Structured Symptom-to-Signal Translation for Rare Disease Care",
    version="1.0.0",
    lifespan=lifespan
)

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],  # restrict in production
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"]
# )

# ─── CORS Configuration ─────────────────────────────────────────────

origins = [
    "http://localhost:3000",  # React dev server
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Utility ───────────────────────────────────────────────────────────────────

def _get_patient_or_404(patient_id: str, db: Session) -> Patient:
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found")
    return patient


def _entries_to_dicts(entries: List[SymptomEntry]) -> List[dict]:
    return [{
        "timestamp": e.timestamp,
        "symptoms": e.symptoms,
        "triggers": e.triggers,
        "notes": e.notes
    } for e in entries]


def _get_or_init_baseline(patient_id: str, db: Session) -> BaselineProfile:
    baseline = db.query(BaselineProfile).filter(BaselineProfile.patient_id == patient_id).first()
    if not baseline:
        baseline = BaselineProfile(
            patient_id=patient_id,
            mu_json="{}",
            sigma_json="{}",
            n_observations=0
        )
        db.add(baseline)
        db.commit()
        db.refresh(baseline)
    return baseline


def _update_baseline_from_entry(baseline: BaselineProfile, symptoms: dict, db: Session):
    """Update EWMA baseline with new symptom entry."""
    mu = baseline.mu
    sigma = baseline.sigma
    alpha = baseline.alpha

    for sym, val in symptoms.items():
        mu_prev = mu.get(sym, val)
        sig_prev = sigma.get(sym, 2.0)
        mu_new, sig_new = update_ewma_baseline(mu_prev, sig_prev, val, alpha)
        mu[sym] = round(mu_new, 4)
        sigma[sym] = round(sig_new, 4)

    baseline.mu_json = json.dumps(mu)
    baseline.sigma_json = json.dumps(sigma)
    baseline.n_observations += 1
    baseline.last_updated = datetime.utcnow()
    db.commit()


# ─── Patients ──────────────────────────────────────────────────────────────────

@app.post("/patients", response_model=PatientResponse, tags=["Patients"])
def create_patient(body: PatientCreate, db: Session = Depends(get_db)):
    if body.disease not in DISEASE_CONFIGS:
        raise HTTPException(400, f"Unknown disease: {body.disease}")
    existing = db.query(Patient).filter(Patient.id == body.id).first()
    if existing:
        raise HTTPException(409, f"Patient '{body.id}' already exists")
    patient = Patient(id=body.id, disease=body.disease)
    db.add(patient)
    # Initialize baseline profile
    baseline = BaselineProfile(patient_id=body.id, mu_json="{}", sigma_json="{}")
    db.add(baseline)
    db.commit()
    db.refresh(patient)
    return patient


@app.get("/patients/{patient_id}", response_model=PatientResponse, tags=["Patients"])
def get_patient(patient_id: str, db: Session = Depends(get_db)):
    return _get_patient_or_404(patient_id, db)


@app.get("/patients", response_model=List[PatientResponse], tags=["Patients"])
def list_patients(db: Session = Depends(get_db)):
    return db.query(Patient).all()


# ─── Symptom Entries ───────────────────────────────────────────────────────────

@app.post("/entries", response_model=SymptomEntryResponse, tags=["Entries"])
def add_symptom_entry(body: SymptomEntryCreate, db: Session = Depends(get_db)):
    patient = _get_patient_or_404(body.patient_id, db)
    config = DISEASE_CONFIGS[patient.disease]

    # Validate symptom names
    valid_symptoms = config.get("symptoms", [])
    for sym in body.symptoms:
        if sym not in valid_symptoms:
            raise HTTPException(400, f"Unknown symptom '{sym}' for disease {patient.disease}")

    # Validate symptom range
    for sym, val in body.symptoms.items():
        if not (0.0 <= val <= 10.0):
            raise HTTPException(400, f"Symptom '{sym}' value {val} out of range [0, 10]")

    timestamp = body.timestamp or datetime.utcnow()
    entry = SymptomEntry(
        patient_id=body.patient_id,
        timestamp=timestamp,
        symptoms_json=json.dumps(body.symptoms),
        triggers_json=json.dumps(body.triggers),
        notes=body.notes
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    # Update baseline
    baseline = _get_or_init_baseline(body.patient_id, db)
    _update_baseline_from_entry(baseline, body.symptoms, db)

    return SymptomEntryResponse(
        id=entry.id,
        patient_id=entry.patient_id,
        timestamp=entry.timestamp,
        symptoms=entry.symptoms,
        triggers=entry.triggers,
        notes=entry.notes
    )


@app.get("/patients/{patient_id}/entries", response_model=List[SymptomEntryResponse], tags=["Entries"])
def get_entries(patient_id: str, limit: int = 100, db: Session = Depends(get_db)):
    _get_patient_or_404(patient_id, db)
    entries = (db.query(SymptomEntry)
               .filter(SymptomEntry.patient_id == patient_id)
               .order_by(SymptomEntry.timestamp.desc())
               .limit(limit).all())
    return [SymptomEntryResponse(
        id=e.id, patient_id=e.patient_id, timestamp=e.timestamp,
        symptoms=e.symptoms, triggers=e.triggers, notes=e.notes
    ) for e in entries]


# ─── Signal Computation ────────────────────────────────────────────────────────

@app.post("/compute-signals", response_model=SignalResponse, tags=["Signals"])
def compute_signals(body: SignalRequest, db: Session = Depends(get_db)):
    patient = _get_patient_or_404(body.patient_id, db)
    baseline = _get_or_init_baseline(body.patient_id, db)

    entries = (db.query(SymptomEntry)
               .filter(SymptomEntry.patient_id == body.patient_id)
               .order_by(SymptomEntry.timestamp.asc())
               .all())

    entry_dicts = _entries_to_dicts(entries)

    # Bootstrap baseline if needed
    if baseline.n_observations < 5 and entry_dicts:
        for sym in DISEASE_CONFIGS[patient.disease].get("symptoms", []):
            values = [e["symptoms"].get(sym) for e in entry_dicts if sym in e["symptoms"]]
            if values:
                mu, sig = initialize_baseline_from_history(values)
                mu_dict = baseline.mu
                sig_dict = baseline.sigma
                mu_dict[sym] = round(mu, 4)
                sig_dict[sym] = round(sig, 4)
                baseline.mu_json = json.dumps(mu_dict)
                baseline.sigma_json = json.dumps(sig_dict)
        db.commit()

    signals = compute_all_signals(
        entry_dicts,
        baseline.mu,
        baseline.sigma,
        patient.disease,
        body.window_days
    )

    # Persist computed signals
    cs = ComputedSignal(
        patient_id=body.patient_id,
        computed_at=datetime.utcnow(),
        z_scores_json=json.dumps({k: v.get("z_score", 0) for k, v in signals["z_scores"].items()}),
        volatility_index=signals["volatility"].get("value", 0.0),
        flare_acceleration=signals["flare_acceleration"].get("slope_7d", 0.0),
        trigger_correlations_json=json.dumps(signals["trigger_correlations"]),
        data_completeness=signals["missingness"].get("completeness_pct", 0) / 100.0,
        risk_category=signals["risk_category"],
        signals_suppressed_json=json.dumps(signals["missingness"].get("suppressed_signals", []))
    )
    db.add(cs)

    # Persist FIS
    fis = signals["functional_impact"]
    fs = FunctionalScore(
        patient_id=body.patient_id,
        computed_at=datetime.utcnow(),
        fis_composite=fis.get("composite", 0.0),
        domain_scores_json=json.dumps({
            k: fis.get(k, 0.0) for k in ["mobility", "cognitive", "sleep", "work", "social"]
        })
    )
    db.add(fs)

    # Create alert if needed
    if signals["risk_category"] in ("HIGH", "CRITICAL"):
        alert = Alert(
            patient_id=body.patient_id,
            alert_type=signals["risk_category"],
            risk_category=signals["risk_category"],
            message=f"Signal alert: {signals['risk_category']} risk detected. Red flags: {signals['red_flags']}"
        )
        db.add(alert)

    db.commit()

    # Build response
    from backend.schemas import (
        ZScoreDetail, VolatilityDetail, FlareAcceleration,
        TriggerCorrelation, FunctionalImpact, MissingnessDetail
    )

    z_resp = {k: ZScoreDetail(**v) for k, v in signals["z_scores"].items()}
    vol = signals["volatility"]
    vol_resp = VolatilityDetail(
        value=vol.get("value", 0.0),
        rolling_std=vol.get("rolling_std", 0.0),
        coefficient_of_variation=vol.get("cv", 0.0),
        approximate_entropy=vol.get("apen", 0.0),
        label=vol.get("label", "low")
    )
    fa = signals["flare_acceleration"]
    fa_resp = FlareAcceleration(
        slope_7d=fa.get("slope_7d", 0.0),
        slope_r2=fa.get("slope_r2", 0.0),
        change_point_detected=fa.get("change_point_detected", False),
        change_point_day=fa.get("change_point_day"),
        acceleration_label=fa.get("acceleration_label", "stable")
    )
    tc_resp = [TriggerCorrelation(**t) for t in signals["trigger_correlations"]]
    fi = signals["functional_impact"]
    fi_resp = FunctionalImpact(
        mobility=fi.get("mobility", 0.0),
        cognitive=fi.get("cognitive", 0.0),
        sleep=fi.get("sleep", 0.0),
        work=fi.get("work", 0.0),
        social=fi.get("social", 0.0),
        composite=fi.get("composite", 0.0),
        severity_label=fi.get("severity_label", "minimal")
    )
    miss = signals["missingness"]
    miss_resp = MissingnessDetail(
        completeness_pct=miss.get("completeness_pct", 0.0),
        entries_found=miss.get("entries_found", 0),
        entries_expected=miss.get("entries_expected", body.window_days),
        confidence_level=miss.get("confidence_level", "INSUFFICIENT"),
        suppressed_signals=miss.get("suppressed_signals", [])
    )

    return SignalResponse(
        patient_id=body.patient_id,
        computed_at=datetime.utcnow(),
        window_days=body.window_days,
        z_scores=z_resp,
        volatility=vol_resp,
        flare_acceleration=fa_resp,
        trigger_correlations=tc_resp,
        functional_impact=fi_resp,
        missingness=miss_resp,
        risk_category=signals["risk_category"],
        red_flags=signals["red_flags"]
    )


# ─── Risk Prediction ───────────────────────────────────────────────────────────

@app.post("/predict-risk", response_model=RiskPredictionResponse, tags=["ML"])
def predict_risk(body: RiskPredictionRequest, db: Session = Depends(get_db)):
    """
    Rule-based + signal-driven risk prediction.
    Returns risk probabilities derived from signal intensities.
    (Full ML model requires training data; this is the signal-based fallback for hackathon.)
    """
    patient = _get_patient_or_404(body.patient_id, db)
    latest_signal = (db.query(ComputedSignal)
                     .filter(ComputedSignal.patient_id == body.patient_id)
                     .order_by(ComputedSignal.computed_at.desc())
                     .first())

    if not latest_signal:
        raise HTTPException(404, "No signals computed yet. Call /compute-signals first.")

    risk_cat = latest_signal.risk_category
    vi = latest_signal.volatility_index or 0.0
    z_max = max(latest_signal.z_scores.values()) if latest_signal.z_scores else 0.0

    # Signal-derived probability estimates (conservative heuristic)
    def softmax_probs(scores):
        import math
        e = [math.exp(s) for s in scores]
        total = sum(e)
        return [round(x / total, 4) for x in e]

    # Score each category based on signals
    scores = {
        "LOW": max(0.0, 2.0 - z_max - vi * 2),
        "MODERATE": max(0.0, 1.0 + z_max * 0.3 - abs(z_max - 1.5) * 0.5),
        "HIGH": max(0.0, z_max * 0.5 + vi),
        "CRITICAL": max(0.0, (z_max - 2.0) + vi * 2)
    }
    probs_list = softmax_probs(list(scores.values()))
    probs = dict(zip(scores.keys(), probs_list))

    # Top contributing features
    top_features = [
        {"feature": "z_score_max", "importance": round(min(z_max / 4, 1.0), 3),
         "direction": "+" if z_max > 0 else "-"},
        {"feature": "volatility_index", "importance": round(vi, 3),
         "direction": "+"},
        {"feature": "data_completeness", "importance": round(latest_signal.data_completeness or 0, 3),
         "direction": "-"}
    ]

    # Simple 3-day forecast: assume trend continuation with mean reversion
    entries = (db.query(SymptomEntry)
               .filter(SymptomEntry.patient_id == body.patient_id)
               .order_by(SymptomEntry.timestamp.desc())
               .limit(7).all())

    if entries:
        recent_means = []
        for e in entries:
            vals = list(e.symptoms.values())
            if vals:
                recent_means.append(sum(vals) / len(vals))
        recent_means.reverse()
        if recent_means:
            last = recent_means[-1]
            # Simple mean-reverting forecast
            target = sum(recent_means) / len(recent_means)
            forecast = [
                round(last + (target - last) * (i + 1) / 4, 2)
                for i in range(3)
            ]
        else:
            forecast = [5.0, 5.0, 5.0]
    else:
        forecast = [5.0, 5.0, 5.0]

    return RiskPredictionResponse(
        patient_id=body.patient_id,
        risk_category=risk_cat,
        risk_probabilities=probs,
        top_contributing_features=top_features,
        forecast_3d=forecast,
        confidence=latest_signal.data_completeness and
                   ("HIGH" if latest_signal.data_completeness > 0.8 else "MODERATE")
                   or "LOW"
    )


# ─── Summary Generation ────────────────────────────────────────────────────────

@app.post("/generate-summary", response_model=ClinicalSummaryResponse, tags=["Summary"])
def generate_summary(body: SummaryRequest, db: Session = Depends(get_db)):
    patient = _get_patient_or_404(body.patient_id, db)
    config = DISEASE_CONFIGS[patient.disease]

    # Get latest signals
    latest_signal = (db.query(ComputedSignal)
                     .filter(ComputedSignal.patient_id == body.patient_id)
                     .order_by(ComputedSignal.computed_at.desc())
                     .first())
    latest_fis = (db.query(FunctionalScore)
                  .filter(FunctionalScore.patient_id == body.patient_id)
                  .order_by(FunctionalScore.computed_at.desc())
                  .first())

    if not latest_signal:
        raise HTTPException(404, "No signals computed yet. Call /compute-signals first.")

    # Reconstruct signal dict from DB
    signals = {
        "z_scores": {
            sym: {"z_score": z, "value": 0, "baseline_mu": 0, "baseline_sigma": 0,
                  "interpretation": "elevated" if abs(z) > 1 else "stable"}
            for sym, z in latest_signal.z_scores.items()
        },
        "volatility": {
            "value": latest_signal.volatility_index or 0.0,
            "rolling_std": 0.0, "cv": 0.0, "apen": 0.0,
            "label": "high" if (latest_signal.volatility_index or 0) > 0.6
                     else "moderate" if (latest_signal.volatility_index or 0) > 0.3 else "low"
        },
        "flare_acceleration": {
            "slope_7d": latest_signal.flare_acceleration or 0.0,
            "slope_r2": 0.0, "change_point_detected": False,
            "change_point_day": None, "acceleration_label": "stable"
        },
        "trigger_correlations": latest_signal.trigger_correlations,
        "functional_impact": {
            "composite": latest_fis.fis_composite if latest_fis else 0.0,
            "severity_label": "minimal",
            **(latest_fis.domain_scores if latest_fis else {})
        },
        "missingness": {
            "completeness_pct": (latest_signal.data_completeness or 0) * 100,
            "entries_found": 0, "entries_expected": body.window_days,
            "confidence_level": "MODERATE", "suppressed_signals": latest_signal.signals_suppressed
        },
        "risk_category": latest_signal.risk_category,
        "red_flags": []
    }

    summary = generate_structured_summary(
        patient_id=body.patient_id,
        disease=patient.disease,
        disease_name=config["name"],
        signals=signals,
        window_days=body.window_days
    )

    return ClinicalSummaryResponse(**summary)


@app.post("/generate-ai-explainer", response_model=DetailedReportResponse, tags=["Summary"])
def generate_ai_explainer(body: DetailedReportRequest, db: Session = Depends(get_db)):
    # Authenticate via patient check
    _get_patient_or_404(body.patient_id, db)
    report_text = generate_detailed_ai_report(
        patient_id=body.patient_id,
        disease_name=body.disease_name,
        deviations=body.deviations
    )
    return DetailedReportResponse(report_text=report_text)


# ─── Semantic HPO Matching ──────────────────────────────────────────────────────

@app.post("/match-hpo", response_model=HPOMatchResponse, tags=["HPO"])
def semantic_hpo_match(body: HPOMatchRequest):
    """
    Semantically match a symptom key or free text to the nearest HPO term(s)
    using TF-IDF cosine similarity.
    """
    raw_matches = match_symptom(body.symptom_text, body.disease_id, body.top_k)
    return HPOMatchResponse(
        query=body.symptom_text,
        disease_id=body.disease_id,
        matches=[HPOMatchResult(**m) for m in raw_matches]
    )


@app.get("/diseases/{disease_id}/hpo-cluster", tags=["HPO"])
def disease_hpo_cluster(disease_id: str):
    """
    Return the full HPO semantic cluster for a disease —
    each symptom mapped to its closest HPO term and semantic neighbors.
    """
    if disease_id not in DISEASE_CONFIGS:
        raise HTTPException(404, f"Disease '{disease_id}' not found")
    return {"disease_id": disease_id, "cluster": get_disease_hpo_cluster(disease_id)}


# ─── Flare / Seizure Prediction Alert ─────────────────────────────────────────

@app.get("/flare-alert/{patient_id}", response_model=FlareAlertResponse, tags=["Alerts"])
def get_flare_alert(patient_id: str, db: Session = Depends(get_db)):
    """
    Predict days-to-next-flare for a patient using their latest computed signal.
    Derives a probability-weighted estimate from:
      - most recent risk category
      - symptom volatility index
      - z-score magnitude of primary deviations
    Returns an alert level and a user-visible message.
    """
    patient = _get_patient_or_404(patient_id, db)

    # Fetch latest computed signal
    latest_signal = (
        db.query(ComputedSignal)
        .filter(ComputedSignal.patient_id == patient_id)
        .order_by(ComputedSignal.computed_at.desc())
        .first()
    )

    if not latest_signal:
        return FlareAlertResponse(
            patient_id=patient_id,
            days_to_flare=30.0,
            alert_level="NORMAL",
            alert_color="#3fb950",
            message="No signals computed yet. Log symptoms to enable flare prediction.",
            confidence="LOW",
            based_on_risk="INSUFFICIENT_DATA"
        )

    risk = latest_signal.risk_category or "INSUFFICIENT_DATA"
    volatility = latest_signal.volatility_index or 0.0
    z_max = latest_signal.z_score_max or 0.0

    # Derive days-to-flare heuristic:
    # Base window from risk, refined by volatility and z-score magnitude
    base = {"CRITICAL": 2.0, "HIGH": 7.0, "MODERATE": 14.0, "LOW": 25.0, "INSUFFICIENT_DATA": 30.0}
    days = base.get(risk, 30.0)

    # Volatility shifts prediction earlier (high volatility = sooner flare)
    vol_adjustment = min(volatility * 5.0, 10.0)  # cap at -10 days
    z_adjustment = min(max(z_max - 1.0, 0.0) * 2.0, 8.0)  # z>1 → earlier
    days = max(1.0, days - vol_adjustment - z_adjustment)

    # Confidence: measured by how much data we have
    entry_count = db.query(SymptomEntry).filter(SymptomEntry.patient_id == patient_id).count()
    confidence = "HIGH" if entry_count >= 14 else "MODERATE" if entry_count >= 7 else "LOW"

    # Alert level thresholds
    if days <= 5:
        level, color = "CRITICAL", "#f85149"
        msg = f"Flare predicted in ~{days:.0f} day(s). Recommend urgent symptom review and care team contact."
    elif days <= 10:
        level, color = "WARNING", "#d29922"
        msg = f"Elevated flare risk — estimated ~{days:.0f} days. Consider proactive symptom logging."
    elif days <= 20:
        level, color = "WATCH", "#e3b341"
        msg = f"Flare may occur in ~{days:.0f} days. Maintain daily symptom tracking."
    else:
        level, color = "NORMAL", "#3fb950"
        msg = f"Low flare risk. Next predicted flare in ~{days:.0f} days. Keep up routine monitoring."

    return FlareAlertResponse(
        patient_id=patient_id,
        days_to_flare=round(days, 1),
        alert_level=level,
        alert_color=color,
        message=msg,
        confidence=confidence,
        based_on_risk=risk
    )


# ─── History ────────────────────────────────────────────────────────────────────

@app.get("/patients/{patient_id}/history", response_model=PatientHistoryResponse, tags=["History"])
def get_patient_history(patient_id: str, db: Session = Depends(get_db)):
    patient = _get_patient_or_404(patient_id, db)

    signals = (db.query(ComputedSignal)
               .filter(ComputedSignal.patient_id == patient_id)
               .order_by(ComputedSignal.computed_at.asc())
               .all())

    fis_scores = (db.query(FunctionalScore)
                  .filter(FunctionalScore.patient_id == patient_id)
                  .order_by(FunctionalScore.computed_at.asc())
                  .all())

    fis_map = {fs.computed_at.date().isoformat(): fs.fis_composite for fs in fis_scores}

    history = []
    for s in signals:
        date_str = s.computed_at.date().isoformat()
        z_max = max(s.z_scores.values()) if s.z_scores else 0.0
        history.append(SignalHistoryPoint(
            date=date_str,
            z_score_max=round(z_max, 4),
            volatility_index=round(s.volatility_index or 0.0, 4),
            fis_composite=round(fis_map.get(date_str, 0.0) or 0.0, 4),
            risk_category=s.risk_category,
            data_completeness=round((s.data_completeness or 0.0) * 100, 1)
        ))

    total_entries = db.query(SymptomEntry).filter(SymptomEntry.patient_id == patient_id).count()
    days_tracked = 0
    if signals:
        first = signals[0].computed_at
        last = signals[-1].computed_at
        days_tracked = (last - first).days + 1

    return PatientHistoryResponse(
        patient_id=patient_id,
        disease=patient.disease,
        history=history,
        total_entries=total_entries,
        days_tracked=days_tracked
    )


# ─── Disease Config ─────────────────────────────────────────────────────────────

@app.get("/diseases", tags=["Config"])
def list_diseases():
    return [
        {"id": k, "name": v["name"], "symptoms": v["symptoms"],
         "triggers": v["triggers"]}
        for k, v in DISEASE_CONFIGS.items()
    ]


@app.get("/diseases/{disease_id}", tags=["Config"])
def get_disease_config(disease_id: str):
    if disease_id not in DISEASE_CONFIGS:
        raise HTTPException(404, f"Disease '{disease_id}' not found")
    cfg = DISEASE_CONFIGS[disease_id]
    return {
        "id": disease_id,
        "name": cfg["name"],
        "symptoms": cfg["symptoms"],
        "symptom_labels": cfg.get("symptom_labels", {}),
        "triggers": cfg["triggers"],
        "fis_domain_weights": cfg.get("fis_domain_weights", {}),
        "domain_weights": cfg.get("domain_weights", {})
    }


# ─── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "version": "1.0.0", "timestamp": datetime.utcnow().isoformat()}


# ─── Baseline ───────────────────────────────────────────────────────────────────

@app.get("/patients/{patient_id}/baseline", tags=["Baseline"])
def get_baseline(patient_id: str, db: Session = Depends(get_db)):
    _get_patient_or_404(patient_id, db)
    baseline = _get_or_init_baseline(patient_id, db)
    return {
        "patient_id": patient_id,
        "mu": baseline.mu,
        "sigma": baseline.sigma,
        "n_observations": baseline.n_observations,
        "last_updated": baseline.last_updated,
        "alpha": baseline.alpha
    }
