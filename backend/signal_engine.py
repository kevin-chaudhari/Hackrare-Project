# signal_engine.py — Core signal computation: baseline, volatility, triggers, FIS, missingness
"""
Mathematical foundations:
  Baseline:   mu_t = alpha * x_t + (1-alpha) * mu_{t-1}   (EWMA)
              sigma_t = sqrt(alpha*(x_t - mu_t)^2 + (1-alpha)*sigma_{t-1}^2)
              z(t) = (x(t) - mu_B(t)) / max(sigma_B(t), epsilon)

  Volatility: VI = 0.4*norm(sigma_roll) + 0.3*norm(CV) + 0.3*norm(ApEn)
              CV = sigma_roll / (mu_roll + epsilon)
              ApEn(m, r) = phi_m - phi_{m+1}

  FIS:        FIS_domain = sum_i(w_i * norm_symptom_i)
              FIS_composite = sum_d(W_d * FIS_domain_d)

  Correlation: Spearman rho with 1-day lag (trigger -> next-day symptom)
"""
import json
import math
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from scipy import stats
from scipy.stats import spearmanr
from typing import Dict, List, Tuple, Optional

from backend.disease_config import DISEASE_CONFIGS


# ─── Constants ────────────────────────────────────────────────────────────────
CONFIDENCE_THRESHOLDS = {"HIGH": 0.80, "MODERATE": 0.60, "LOW": 0.40}
VOLATILITY_THRESHOLDS = {"high": 0.6, "moderate": 0.3}
Z_THRESHOLDS = {"highly_elevated": 2.0, "elevated": 1.0}
MIN_CORRELATION_OBS = 5


# ─── 1. Baseline Engine ───────────────────────────────────────────────────────

def update_ewma_baseline(
    mu_prev: float,
    sigma_prev: float,
    x_new: float,
    alpha: float = 0.1
) -> Tuple[float, float]:
    """
    Update EWMA baseline with new observation.
    Returns (mu_new, sigma_new).
    """
    mu_new = alpha * x_new + (1.0 - alpha) * mu_prev
    var_new = alpha * (x_new - mu_new) ** 2 + (1.0 - alpha) * (sigma_prev ** 2)
    sigma_new = math.sqrt(max(var_new, 1e-6))
    return mu_new, sigma_new


def compute_z_score(x: float, mu: float, sigma: float) -> float:
    return (x - mu) / max(sigma, 0.01)


def interpret_z_score(z: float) -> str:
    if z >= Z_THRESHOLDS["highly_elevated"]:
        return "highly_elevated"
    elif z >= Z_THRESHOLDS["elevated"]:
        return "elevated"
    elif z <= -Z_THRESHOLDS["elevated"]:
        return "below_baseline"
    return "stable"


def initialize_baseline_from_history(values: List[float], alpha: float = 0.1) -> Tuple[float, float]:
    """Bootstrap baseline from initial observations using cumulative EWMA."""
    if not values:
        return 5.0, 2.0  # neutral defaults
    mu = float(np.mean(values[:7]))  # seed with first week mean
    sigma = float(np.std(values[:7]) + 0.1)
    for v in values[7:]:
        mu, sigma = update_ewma_baseline(mu, sigma, v, alpha)
    return mu, sigma


# ─── 2. Flare Acceleration Signal ────────────────────────────────────────────

def compute_rolling_slope(series: List[float], window: int = 7) -> Tuple[float, float, float]:
    """
    Fit linear regression over window. Returns (slope, R2, p_value).
    Slope units: severity points per day.
    """
    if len(series) < 3:
        return 0.0, 0.0, 1.0
    y = np.array(series[-window:], dtype=float)
    x = np.arange(len(y), dtype=float)
    if np.std(y) < 1e-6:
        return 0.0, 0.0, 1.0
    slope, intercept, r_value, p_value, _ = stats.linregress(x, y)
    return float(slope), float(r_value ** 2), float(p_value)


def detect_change_point(series: List[float]) -> Tuple[bool, Optional[int]]:
    """
    Simple CUSUM-based change point detection.
    Returns (detected, day_index_from_end).
    """
    if len(series) < 7:
        return False, None
    arr = np.array(series, dtype=float)
    mean = np.mean(arr)
    std = np.std(arr) + 1e-6
    cusum_pos = 0.0
    threshold = 4.0  # sigma-based threshold
    h = 1.0  # slack
    last_cp = None
    for i, x in enumerate(arr):
        cusum_pos = max(0, cusum_pos + (x - mean) / std - h)
        if cusum_pos > threshold:
            last_cp = i
            cusum_pos = 0.0
    if last_cp is not None:
        return True, int(len(series) - last_cp)
    return False, None


def label_acceleration(slope: float, r2: float) -> str:
    if slope < -0.3 and r2 > 0.3:
        return "improving"
    elif slope > 0.5 and r2 > 0.5:
        return "rapid_worsening"
    elif slope > 0.2 and r2 > 0.3:
        return "worsening"
    return "stable"


# ─── 3. Volatility Index ─────────────────────────────────────────────────────

def approximate_entropy(series: List[float], m: int = 2, r_factor: float = 0.2) -> float:
    """
    Compute Approximate Entropy (ApEn).
    Higher value = more irregular/unpredictable = clinically significant instability.
    """
    N = len(series)
    if N < m + 2:
        return 0.0
    u = np.array(series, dtype=float)
    r = r_factor * np.std(u)
    if r < 1e-6:
        return 0.0

    def phi(m_val):
        templates = np.array([u[i:i + m_val] for i in range(N - m_val + 1)])
        count = 0
        for i in range(len(templates)):
            dists = np.max(np.abs(templates - templates[i]), axis=1)
            count += np.sum(dists <= r)
        return math.log(count / (N - m_val + 1)) if count > 0 else 0.0

    return abs(phi(m) - phi(m + 1))


def _safe_normalize(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    if hi - lo < 1e-8:
        return 0.0
    return min(1.0, max(0.0, (x - lo) / (hi - lo)))


def compute_volatility_index(series: List[float], window: int = 7) -> Dict:
    """
    Composite volatility index combining rolling std, CV, and ApEn.
    Returns dict with individual components and composite VI (0-1).
    """
    if len(series) < 3:
        return {"value": 0.0, "rolling_std": 0.0, "cv": 0.0, "apen": 0.0, "label": "low"}

    arr = np.array(series[-window:], dtype=float)
    rolling_std = float(np.std(arr))
    rolling_mean = float(np.mean(arr)) + 1e-6
    cv = rolling_std / rolling_mean
    apen = approximate_entropy(list(arr))

    # Normalize components (empirical bounds for 0-10 symptom scales)
    std_norm = _safe_normalize(rolling_std, 0, 4.0)
    cv_norm = _safe_normalize(cv, 0, 1.5)
    apen_norm = _safe_normalize(apen, 0, 2.0)

    vi = 0.4 * std_norm + 0.3 * cv_norm + 0.3 * apen_norm

    if vi >= VOLATILITY_THRESHOLDS["high"]:
        label = "high"
    elif vi >= VOLATILITY_THRESHOLDS["moderate"]:
        label = "moderate"
    else:
        label = "low"

    return {
        "value": round(vi, 4),
        "rolling_std": round(rolling_std, 4),
        "cv": round(cv, 4),
        "apen": round(apen, 4),
        "label": label
    }


# ─── 4. Trigger Association Signal ───────────────────────────────────────────

def compute_trigger_correlations(
    entries: List[Dict],
    symptom_col: str,
    triggers: List[str],
    lag: int = 1
) -> List[Dict]:
    """
    Compute Spearman correlation between each trigger presence and
    next-day symptom severity (1-day lagged).
    """
    if len(entries) < MIN_CORRELATION_OBS:
        return []

    df = pd.DataFrame([{
        "timestamp": e["timestamp"],
        "symptom": e["symptoms"].get(symptom_col, np.nan),
        **{f"t_{t}": int(t in e["triggers"]) for t in triggers}
    } for e in entries]).sort_values("timestamp").reset_index(drop=True)

    results = []
    for t in triggers:
        col = f"t_{t}"
        if col not in df.columns:
            continue
        # Lagged correlation: trigger[i] → symptom[i+lag]
        x = df[col].values[:-lag].astype(float)
        y = df["symptom"].values[lag:].astype(float)
        valid = ~np.isnan(x) & ~np.isnan(y)
        if valid.sum() < MIN_CORRELATION_OBS:
            continue
        try:
            rho, pval = spearmanr(x[valid], y[valid])
        except Exception:
            continue
        if math.isnan(rho):
            continue
        results.append({
            "trigger": t,
            "correlation": round(float(rho), 4),
            "p_value": round(float(pval), 4),
            "significant": bool(pval < 0.05 and abs(rho) > 0.3)
        })

    return sorted(results, key=lambda r: abs(r["correlation"]), reverse=True)


# ─── 5. Functional Impact Score ──────────────────────────────────────────────

def compute_fis(
    current_symptoms: Dict[str, float],
    config: Dict
) -> Dict:
    """
    Compute disease-specific Functional Impact Score across 5 ICF-aligned domains.

    FIS_domain = sum_i(w_i * normalized_symptom_i)
    FIS_composite = sum_d(W_d * FIS_domain_d)

    Returns dict with domain scores and composite FIS (0-1).
    """
    domain_weights_config = config.get("fis_domain_weights", {})
    global_domain_weights = config.get("domain_weights", {
        "mobility": 0.2, "cognitive": 0.2, "sleep": 0.2, "work": 0.2, "social": 0.2
    })

    domain_scores = {}
    for domain, symptom_map in domain_weights_config.items():
        score = 0.0
        total_weight = 0.0
        for symptom, w in symptom_map.items():
            val = current_symptoms.get(symptom, None)
            if val is not None:
                score += w * (val / 10.0)  # normalize to 0-1
                total_weight += w
        domain_scores[domain] = round(score / total_weight, 4) if total_weight > 0 else 0.0

    composite = sum(
        global_domain_weights.get(d, 0.2) * domain_scores.get(d, 0.0)
        for d in ["mobility", "cognitive", "sleep", "work", "social"]
    )

    severity_label = _fis_severity_label(composite)

    return {
        "mobility": domain_scores.get("mobility", 0.0),
        "cognitive": domain_scores.get("cognitive", 0.0),
        "sleep": domain_scores.get("sleep", 0.0),
        "work": domain_scores.get("work", 0.0),
        "social": domain_scores.get("social", 0.0),
        "composite": round(composite, 4),
        "severity_label": severity_label
    }


def _fis_severity_label(score: float) -> str:
    if score >= 0.80: return "critical"
    if score >= 0.65: return "severe"
    if score >= 0.45: return "moderate"
    if score >= 0.25: return "mild"
    return "minimal"


# ─── 6. Missingness & Confidence ─────────────────────────────────────────────

def compute_missingness(
    entries: List[Dict],
    window_days: int = 7,
    expected_per_day: int = 1
) -> Dict:
    """
    Compute data completeness and confidence level.
    Returns completeness (0-1), confidence label, suppressed signals.
    """
    expected = window_days * expected_per_day
    actual = len([e for e in entries if e.get("in_window", True)])

    completeness = min(1.0, actual / max(expected, 1))

    if completeness >= CONFIDENCE_THRESHOLDS["HIGH"]:
        confidence_level = "HIGH"
        suppressed = []
    elif completeness >= CONFIDENCE_THRESHOLDS["MODERATE"]:
        confidence_level = "MODERATE"
        suppressed = []
    elif completeness >= CONFIDENCE_THRESHOLDS["LOW"]:
        confidence_level = "LOW"
        suppressed = ["trigger_correlations", "flare_acceleration"]
    else:
        confidence_level = "INSUFFICIENT"
        suppressed = ["z_scores", "volatility", "trigger_correlations",
                      "flare_acceleration", "functional_impact"]

    return {
        "completeness_pct": round(completeness * 100, 1),
        "entries_found": actual,
        "entries_expected": expected,
        "confidence_level": confidence_level,
        "suppressed_signals": suppressed
    }


# ─── 7. Risk Categorization ───────────────────────────────────────────────────

def categorize_risk(
    z_scores: Dict[str, float],
    volatility_index: float,
    fis_composite: float,
    red_flags: List[str],
    completeness: float
) -> str:
    """
    Rule-based risk categorization.
    Conservative: errs toward over-reporting.
    """
    if completeness < CONFIDENCE_THRESHOLDS["LOW"]:
        return "INSUFFICIENT_DATA"

    if red_flags:
        return "CRITICAL"

    z_max = max(z_scores.values()) if z_scores else 0.0

    if z_max > 3.0 or (z_max > 2.0 and volatility_index > 0.7):
        return "CRITICAL"
    elif z_max > 2.0 or (z_max > 1.5 and volatility_index > 0.5):
        return "HIGH"
    elif z_max > 1.0 or volatility_index > 0.4 or fis_composite > 0.65:
        return "MODERATE"
    return "LOW"


# ─── 8. Red Flag Detection ────────────────────────────────────────────────────

def detect_red_flags(
    current_symptoms: Dict[str, float],
    z_scores: Dict[str, float],
    config: Dict
) -> List[str]:
    """
    Check disease-specific red flag rules.
    Returns list of triggered red flag names.
    """
    red_flags = config.get("red_flags", {})
    triggered = []

    for flag_name, rule in red_flags.items():
        syms = rule.get("symptoms", [])
        z_thresh = rule.get("z_threshold")
        any_thresh = rule.get("any_occurrence_threshold")

        for sym in syms:
            if z_thresh and z_scores.get(sym, 0.0) >= z_thresh:
                triggered.append(flag_name)
                break
            if any_thresh is not None:
                val = current_symptoms.get(sym, 0.0)
                if val >= any_thresh:
                    triggered.append(flag_name)
                    break

    return list(set(triggered))


# ─── 9. Master Signal Computation ────────────────────────────────────────────

def compute_all_signals(
    entries: List[Dict],
    baseline_mu: Dict[str, float],
    baseline_sigma: Dict[str, float],
    disease: str,
    window_days: int = 7
) -> Dict:
    """
    Main signal computation orchestrator.
    Takes list of entry dicts (with 'timestamp', 'symptoms', 'triggers').
    Returns complete signal dict.
    """
    config = DISEASE_CONFIGS.get(disease, {})
    now = datetime.utcnow()
    cutoff = now - timedelta(days=window_days)

    # Filter to window
    window_entries = [e for e in entries if e["timestamp"] >= cutoff]
    for e in window_entries:
        e["in_window"] = True

    # ── Missingness
    missingness = compute_missingness(window_entries, window_days)

    if not window_entries:
        return {
            "z_scores": {},
            "volatility": {"value": 0.0, "rolling_std": 0.0, "cv": 0.0, "apen": 0.0, "label": "low"},
            "flare_acceleration": {"slope_7d": 0.0, "slope_r2": 0.0,
                                   "change_point_detected": False, "change_point_day": None,
                                   "acceleration_label": "stable"},
            "trigger_correlations": [],
            "functional_impact": {"mobility": 0.0, "cognitive": 0.0, "sleep": 0.0,
                                  "work": 0.0, "social": 0.0, "composite": 0.0,
                                  "severity_label": "minimal"},
            "missingness": missingness,
            "risk_category": "INSUFFICIENT_DATA",
            "red_flags": []
        }

    # ── Latest symptoms
    latest_entry = max(window_entries, key=lambda e: e["timestamp"])
    current_symptoms = latest_entry["symptoms"]

    # ── Z-scores
    z_scores_detail = {}
    z_scores_raw = {}
    suppressed = missingness["suppressed_signals"]

    if "z_scores" not in suppressed:
        for sym, val in current_symptoms.items():
            mu = baseline_mu.get(sym, 5.0)
            sig = baseline_sigma.get(sym, 2.0)
            z = compute_z_score(val, mu, sig)
            z_scores_raw[sym] = z
            z_scores_detail[sym] = {
                "value": round(val, 2),
                "z_score": round(z, 4),
                "baseline_mu": round(mu, 4),
                "baseline_sigma": round(sig, 4),
                "interpretation": interpret_z_score(z)
            }

    # ── Volatility (aggregate over all symptoms)
    if "volatility" not in suppressed and z_scores_raw:
        # Use mean z-score trajectory across symptoms as composite
        sym_keys = list(current_symptoms.keys())
        composite_series = []
        for e in sorted(window_entries, key=lambda x: x["timestamp"]):
            vals = [e["symptoms"].get(s, np.nan) for s in sym_keys]
            vals = [v for v in vals if not np.isnan(v)]
            if vals:
                composite_series.append(float(np.mean(vals)))
        volatility = compute_volatility_index(composite_series)
    else:
        volatility = {"value": 0.0, "rolling_std": 0.0, "cv": 0.0, "apen": 0.0, "label": "low"}

    # ── Flare Acceleration
    if "flare_acceleration" not in suppressed and len(composite_series if 'composite_series' in dir() else []) >= 3:
        slope, r2, pval = compute_rolling_slope(composite_series)
        cp_detected, cp_day = detect_change_point(composite_series)
        flare_acceleration = {
            "slope_7d": round(slope, 4),
            "slope_r2": round(r2, 4),
            "change_point_detected": cp_detected,
            "change_point_day": cp_day,
            "acceleration_label": label_acceleration(slope, r2)
        }
    else:
        flare_acceleration = {
            "slope_7d": 0.0, "slope_r2": 0.0,
            "change_point_detected": False, "change_point_day": None,
            "acceleration_label": "stable"
        }

    # ── Trigger Correlations
    if "trigger_correlations" not in suppressed and sym_keys:
        primary_symptom = sym_keys[0]  # use first symptom as primary
        trigger_correlations = compute_trigger_correlations(
            entries,  # use all history for better correlation power
            primary_symptom,
            config.get("triggers", [])
        )
    else:
        trigger_correlations = []

    # ── Functional Impact Score
    if "functional_impact" not in suppressed:
        fis = compute_fis(current_symptoms, config)
    else:
        fis = {"mobility": 0.0, "cognitive": 0.0, "sleep": 0.0,
               "work": 0.0, "social": 0.0, "composite": 0.0, "severity_label": "minimal"}

    # ── Red Flags
    red_flags = detect_red_flags(current_symptoms, z_scores_raw, config)

    # ── Risk Category
    risk_category = categorize_risk(
        z_scores_raw,
        volatility.get("value", 0.0),
        fis.get("composite", 0.0),
        red_flags,
        missingness["completeness_pct"] / 100.0
    )

    return {
        "z_scores": z_scores_detail,
        "volatility": volatility,
        "flare_acceleration": flare_acceleration,
        "trigger_correlations": trigger_correlations,
        "functional_impact": fis,
        "missingness": missingness,
        "risk_category": risk_category,
        "red_flags": red_flags
    }
