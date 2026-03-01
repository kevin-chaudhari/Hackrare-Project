# schemas.py — Pydantic request/response schemas
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Literal
from datetime import datetime


# ─── Patients ───────────────────────────────────────────────────────────────

class PatientCreate(BaseModel):
    id: str = Field(..., description="Unique patient identifier (UUID or alias)")
    disease: str = Field(..., description="Disease abbreviation or identifier")

class PatientResponse(BaseModel):
    id: str
    disease: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Symptom Entries ─────────────────────────────────────────────────────────

class SymptomEntryCreate(BaseModel):
    patient_id: str
    timestamp: Optional[datetime] = None  # defaults to now if not provided
    symptoms: Dict[str, float] = Field(
        ...,
        description="Symptom name → severity score 0-10"
    )
    triggers: List[str] = Field(default=[], description="Active triggers")
    notes: Optional[str] = None

class SymptomEntryResponse(BaseModel):
    id: int
    patient_id: str
    timestamp: datetime
    symptoms: Dict[str, float]
    triggers: List[str]
    notes: Optional[str]

    class Config:
        from_attributes = True


# ─── Signals ─────────────────────────────────────────────────────────────────

class SignalRequest(BaseModel):
    patient_id: str
    window_days: int = Field(default=7, ge=3, le=90)

class ZScoreDetail(BaseModel):
    value: float
    z_score: float
    baseline_mu: float
    baseline_sigma: float
    interpretation: str  # "stable", "elevated", "highly_elevated"

class TriggerCorrelation(BaseModel):
    trigger: str
    correlation: float
    p_value: float
    significant: bool

class FunctionalImpact(BaseModel):
    mobility: float
    cognitive: float
    sleep: float
    work: float
    social: float
    composite: float
    severity_label: str  # "minimal", "mild", "moderate", "severe", "critical"

class VolatilityDetail(BaseModel):
    value: float
    rolling_std: float
    coefficient_of_variation: float
    approximate_entropy: float
    label: str  # "low", "moderate", "high"

class MissingnessDetail(BaseModel):
    completeness_pct: float
    entries_found: int
    entries_expected: int
    confidence_level: str  # "HIGH", "MODERATE", "LOW", "INSUFFICIENT"
    suppressed_signals: List[str]

class FlareAcceleration(BaseModel):
    slope_7d: float
    slope_r2: float
    change_point_detected: bool
    change_point_day: Optional[int]
    acceleration_label: str  # "stable", "improving", "worsening", "rapid_worsening"

class SignalResponse(BaseModel):
    patient_id: str
    computed_at: datetime
    window_days: int
    z_scores: Dict[str, ZScoreDetail]
    volatility: VolatilityDetail
    flare_acceleration: FlareAcceleration
    trigger_correlations: List[TriggerCorrelation]
    functional_impact: FunctionalImpact
    missingness: MissingnessDetail
    risk_category: str  # "LOW", "MODERATE", "HIGH", "CRITICAL", "INSUFFICIENT_DATA"
    red_flags: List[str]


# ─── Risk Prediction ─────────────────────────────────────────────────────────

class RiskPredictionRequest(BaseModel):
    patient_id: str

class RiskPredictionResponse(BaseModel):
    patient_id: str
    risk_category: str
    risk_probabilities: Dict[str, float]  # {LOW: p, MODERATE: p, HIGH: p, CRITICAL: p}
    top_contributing_features: List[Dict]  # [{feature, importance, direction}]
    forecast_3d: List[float]  # predicted composite severity for next 3 days
    confidence: str


# ─── Summary Generation ──────────────────────────────────────────────────────

class SummaryRequest(BaseModel):
    patient_id: str
    window_days: int = 7

class ClinicalSummaryResponse(BaseModel):
    patient_id: str
    disease_name: str
    period_label: str
    generated_at: datetime
    # Signal highlights
    primary_deviations: List[str]
    volatility_statement: str
    trigger_statement: str
    functional_impact_statement: str
    confidence_statement: str
    trajectory_statement: str
    # Escalation
    risk_category: str
    escalation_guidance: str
    red_flags: List[str]
    # Scope disclaimer
    scope_disclaimer: str
    # Full structured text
    structured_text: str
    is_ai_generated: bool = False


class DetailedReportRequest(BaseModel):
    patient_id: str
    disease_name: str
    deviations: List[str]

class DetailedReportResponse(BaseModel):
    report_text: str


# ─── HPO Semantic Matching ────────────────────────────────────────────────────

class HPOMatchRequest(BaseModel):
    symptom_text: str
    disease_id: Optional[str] = None
    top_k: int = 3

class HPOMatchResult(BaseModel):
    hpo_id: str
    label: str
    score: float

class HPOMatchResponse(BaseModel):
    query: str
    disease_id: Optional[str]
    matches: List[HPOMatchResult]


# ─── Flare Alert ─────────────────────────────────────────────────────────────

class FlareAlertResponse(BaseModel):
    patient_id: str
    days_to_flare: float          # predicted days until next flare (0-30)
    alert_level: str              # CRITICAL | WARNING | WATCH | NORMAL
    alert_color: str              # hex color for UI
    message: str
    confidence: str               # HIGH | MODERATE | LOW
    based_on_risk: str            # current risk category used for derivation


# ─── History ─────────────────────────────────────────────────────────────────

class SignalHistoryPoint(BaseModel):
    date: str
    z_score_max: float
    volatility_index: float
    fis_composite: float
    risk_category: str
    data_completeness: float

class PatientHistoryResponse(BaseModel):
    patient_id: str
    disease: str
    history: List[SignalHistoryPoint]
    total_entries: int
    days_tracked: int
