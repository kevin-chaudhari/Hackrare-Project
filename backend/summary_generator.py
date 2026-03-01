# # summary_generator.py — Generate clinician-ready structured summary text
# """
# All output language is pre-reviewed for scope compliance.
# NO diagnosis, prognosis, or treatment recommendations are generated.
# Escalation templates only — using conservative language with explicit scope disclaimer.
# """
# from datetime import datetime
# from typing import Dict, List
# import os
# import google.generativeai as genai


# SCOPE_DISCLAIMER = (
#     "IMPORTANT: This summary is a structured documentation aid. "
#     "It does NOT constitute medical advice, diagnosis, or prognosis. "
#     "All clinical decisions remain with qualified healthcare providers."
# )

# ESCALATION_TEMPLATES = {
#     "CRITICAL": (
#         "Red flag signals detected. If the following symptoms persist or worsen, "
#         "consider contacting your care team promptly. This is not medical advice."
#     ),
#     "HIGH": (
#         "Signal elevation detected above personal baseline. If symptoms persist "
#         "beyond 48 hours or worsen, consider contacting your care team. "
#         "This is not medical advice."
#     ),
#     "MODERATE": (
#         "Moderate signal elevation noted. Continue monitoring. If worsening trend "
#         "continues for more than 3-5 days, consider documenting for next clinical visit. "
#         "This is not medical advice."
#     ),
#     "LOW": (
#         "Signals are within or near personal baseline. Continue regular monitoring. "
#         "This is not medical advice."
#     ),
#     "INSUFFICIENT_DATA": (
#         "Insufficient data to generate reliable signal. Please log symptoms more "
#         "consistently for accurate signal generation."
#     )
# }


# def generate_structured_summary(
#     patient_id: str,
#     disease: str,
#     disease_name: str,
#     signals: Dict,
#     window_days: int = 7
# ) -> Dict:
#     """
#     Generate a clinician-ready structured summary from computed signals.
#     Returns all text fields for frontend display and PDF export.
#     """
#     now = datetime.utcnow()
#     risk = signals.get("risk_category", "INSUFFICIENT_DATA")
#     z_scores = signals.get("z_scores", {})
#     volatility = signals.get("volatility", {})
#     flare = signals.get("flare_acceleration", {})
#     triggers = signals.get("trigger_correlations", [])
#     fis = signals.get("functional_impact", {})
#     missingness = signals.get("missingness", {})
#     red_flags = signals.get("red_flags", [])

#     # ── Primary Deviations
#     primary_deviations = []
#     for sym, detail in sorted(z_scores.items(), key=lambda x: abs(x[1].get("z_score", 0)), reverse=True)[:3]:
#         z = detail.get("z_score", 0.0)
#         interp = detail.get("interpretation", "stable")
#         sign = "+" if z >= 0 else ""
#         label = sym.replace("_", " ").title()
#         if abs(z) >= 1.0:
#             primary_deviations.append(f"{label}: {sign}{z:.1f}σ from baseline [{interp.upper()}]")

#     if not primary_deviations:
#         primary_deviations = ["All symptoms within personal baseline range."]

#     # ── Volatility Statement
#     vi = volatility.get("value", 0.0)
#     vi_label = volatility.get("label", "low")
#     volatility_statement = (
#         f"Volatility Index: {vi:.2f} [{vi_label.upper()}] — "
#         f"Rolling std: {volatility.get('rolling_std', 0):.2f}, "
#         f"CV: {volatility.get('cv', 0):.2f}, "
#         f"ApEn: {volatility.get('apen', 0):.2f}"
#     )
#     if vi_label == "high":
#         volatility_statement += " — System instability detected."
#     elif vi_label == "moderate":
#         volatility_statement += " — Moderate variability present."

#     # ── Trigger Statement
#     sig_triggers = [t for t in triggers if t.get("significant")]
#     if sig_triggers:
#         top = sig_triggers[0]
#         t_name = top["trigger"].replace("_", " ").title()
#         t_dir = "positive" if top["correlation"] > 0 else "negative"
#         trigger_statement = (
#             f"Primary trigger association: {t_name} "
#             f"(Spearman r = {top['correlation']:.2f}, p = {top['p_value']:.3f}, "
#             f"{t_dir} association with symptom changes)."
#         )
#         if len(sig_triggers) > 1:
#             others = [t["trigger"].replace("_", " ").title() for t in sig_triggers[1:3]]
#             trigger_statement += f" Also associated: {', '.join(others)}."
#     else:
#         trigger_statement = "No statistically significant trigger associations detected in this window."

#     # ── Functional Impact Statement
#     fis_composite = fis.get("composite", 0.0)
#     fis_label = fis.get("severity_label", "minimal")
#     top_domain = max(
#         {"Mobility": fis.get("mobility", 0), "Cognitive": fis.get("cognitive", 0),
#          "Sleep": fis.get("sleep", 0), "Work": fis.get("work", 0),
#          "Social": fis.get("social", 0)}.items(),
#         key=lambda x: x[1]
#     )
#     functional_impact_statement = (
#         f"Functional Impact Score: {fis_composite:.2f} [{fis_label.upper()}]. "
#         f"Most affected domain: {top_domain[0]} ({top_domain[1]:.2f})."
#     )

#     # ── Confidence Statement
#     completeness = missingness.get("completeness_pct", 0)
#     conf = missingness.get("confidence_level", "INSUFFICIENT")
#     found = missingness.get("entries_found", 0)
#     expected = missingness.get("entries_expected", window_days)
#     confidence_statement = (
#         f"Data completeness: {completeness:.0f}% ({found}/{expected} days logged). "
#         f"Confidence: {conf}."
#     )
#     if missingness.get("suppressed_signals"):
#         confidence_statement += f" Some signals suppressed due to low data: {', '.join(missingness['suppressed_signals'])}."

#     # ── Trajectory Statement
#     slope = flare.get("slope_7d", 0.0)
#     acc_label = flare.get("acceleration_label", "stable")
#     cp = flare.get("change_point_detected", False)
#     trajectory_statement = f"7-day trajectory: {acc_label.replace('_', ' ').title()} (slope: {slope:+.2f} units/day)."
#     if cp:
#         cp_day = flare.get("change_point_day")
#         trajectory_statement += f" Change point detected ~{cp_day} days ago."

#     # ── Red Flags
#     red_flag_statements = [rf.replace("_", " ").title() for rf in red_flags]

#     # ── Escalation
#     escalation_guidance = ESCALATION_TEMPLATES.get(risk, ESCALATION_TEMPLATES["LOW"])

#     # ── Assemble structured text
#     lines = [
#         f"╔══ RARESIGNAL AI — CLINICAL SIGNAL SUMMARY ══╗",
#         f"Patient: {patient_id}  |  Disease: {disease_name}",
#         f"Period: Last {window_days} days  |  Generated: {now.strftime('%Y-%m-%d %H:%M UTC')}",
#         f"Risk Category: {risk}",
#         "",
#         "── SIGNAL DEVIATIONS ──────────────────────────",
#     ] + primary_deviations + [
#         "",
#         "── TRAJECTORY ─────────────────────────────────",
#         trajectory_statement,
#         "",
#         "── VOLATILITY ─────────────────────────────────",
#         volatility_statement,
#         "",
#         "── TRIGGER ASSOCIATIONS ───────────────────────",
#         trigger_statement,
#         "",
#         "── FUNCTIONAL IMPACT ──────────────────────────",
#         functional_impact_statement,
#         "",
#         "── DATA CONFIDENCE ────────────────────────────",
#         confidence_statement,
#     ]

#     if red_flags:
#         lines += ["", "── RED FLAGS ──────────────────────────────────"]
#         lines += [f"⚠ {rf}" for rf in red_flag_statements]

#     lines += [
#         "",
#         "── ESCALATION GUIDANCE ────────────────────────",
#         escalation_guidance,
#         "",
#         "── SCOPE DISCLAIMER ───────────────────────────",
#         SCOPE_DISCLAIMER,
#         "╚══════════════════════════════════════════════╝"
#     ]

#     structured_text = "\n".join(lines)

#     # ── Gemini Enhancement ──
#     # If GEMINI_API_KEY is present, we pass the raw structured text to Gemini to generate
#     # a more cohesive and professional clinician summary, while enforcing the strict scope constraints.
#     api_key = os.environ.get("GEMINI_API_KEY")
#     if api_key:
#         try:
#             genai.configure(api_key=api_key)
#             model = genai.GenerativeModel("gemini-2.5-flash")
#             prompt = f"""
# You are a medical documentation assistant. Your job is to take the following raw structured signals 
# for a patient with {disease_name} and generate a highly professional, concise 'Clinical Signal Summary'.
# You must strictly adhere to the following rules:
# 1. Do not diagnose, prognosticate, or recommend treatments.
# 2. Only summarize the provided data points.
# 3. Must end with the text exactly: "IMPORTANT: This summary is a structured documentation aid. It does NOT constitute medical advice, diagnosis, or prognosis. All clinical decisions remain with qualified healthcare providers."

# Raw Data:
# {structured_text}

# Output format: Please output a well-formatted text report suitable for a clinician dashboard.
#             """
#             response = model.generate_content(prompt)
#             if response.text:
#                 structured_text = response.text
#         except Exception as e:
#             # Fallback to the rule-based structured text if the API fails
#             structured_text += f"\n\n[Note: Gemini enhancement failed: {str(e)}]"

#     return {
#         "patient_id": patient_id,
#         "disease_name": disease_name,
#         "period_label": f"Last {window_days} days",
#         "generated_at": now,
#         "primary_deviations": primary_deviations,
#         "volatility_statement": volatility_statement,
#         "trigger_statement": trigger_statement,
#         "functional_impact_statement": functional_impact_statement,
#         "confidence_statement": confidence_statement,
#         "trajectory_statement": trajectory_statement,
#         "risk_category": risk,
#         "escalation_guidance": escalation_guidance,
#         "red_flags": red_flag_statements,
#         "scope_disclaimer": SCOPE_DISCLAIMER,
#         "structured_text": structured_text
#     }



"""
summary_generator.py
Generate clinician-ready structured summary text.

All output language is pre-reviewed for scope compliance.
NO diagnosis, prognosis, or treatment recommendations are generated.
Escalation templates only — using conservative language with explicit scope disclaimer.
"""

from datetime import datetime
from typing import Dict
import os
import time
import google.generativeai as genai
from dotenv import load_dotenv

# ─────────────────────────────────────────────────────────────
# Environment Setup
# ─────────────────────────────────────────────────────────────

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    GEMINI_MODEL = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        generation_config={
            "temperature": 0.2,          # deterministic clinical tone
            "top_p": 0.8,
            "max_output_tokens": 1200    # protect free tier quota
        }
    )
else:
    GEMINI_MODEL = None


# ─────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────

SCOPE_DISCLAIMER = (
    "IMPORTANT: This summary is a structured documentation aid. "
    "It does NOT constitute medical advice, diagnosis, or prognosis. "
    "All clinical decisions remain with qualified healthcare providers."
)

ESCALATION_TEMPLATES = {
    "CRITICAL": (
        "Red flag signals detected. If symptoms persist or worsen, "
        "consider contacting your care team promptly. This is not medical advice."
    ),
    "HIGH": (
        "Signal elevation detected above personal baseline. If symptoms persist "
        "beyond 48 hours or worsen, consider contacting your care team. "
        "This is not medical advice."
    ),
    "MODERATE": (
        "Moderate signal elevation noted. Continue monitoring. If worsening trend "
        "continues for more than 3–5 days, consider documenting for next clinical visit. "
        "This is not medical advice."
    ),
    "LOW": (
        "Signals are within or near personal baseline. Continue regular monitoring. "
        "This is not medical advice."
    ),
    "INSUFFICIENT_DATA": (
        "Insufficient data to generate reliable signal. Please log symptoms more "
        "consistently for accurate signal generation."
    )
}


# ─────────────────────────────────────────────────────────────
# Main Generator
# ─────────────────────────────────────────────────────────────

def generate_structured_summary(
    patient_id: str,
    disease: str,
    disease_name: str,
    signals: Dict,
    window_days: int = 7
) -> Dict:

    now = datetime.utcnow()

    risk = signals.get("risk_category", "INSUFFICIENT_DATA")
    z_scores = signals.get("z_scores", {})
    volatility = signals.get("volatility", {})
    flare = signals.get("flare_acceleration", {})
    triggers = signals.get("trigger_correlations", [])
    fis = signals.get("functional_impact", {})
    missingness = signals.get("missingness", {})
    red_flags = signals.get("red_flags", [])

    from backend.disease_config import DISEASE_CONFIGS
    hpo_mapping = DISEASE_CONFIGS.get(disease, {}).get("hpo_terms", {})

    # ── Primary Deviations
    primary_deviations = []
    for sym, detail in sorted(
        z_scores.items(),
        key=lambda x: abs(x[1].get("z_score", 0)),
        reverse=True
    )[:3]:
        z = detail.get("z_score", 0.0)
        if abs(z) >= 1.0:
            label = sym.replace("_", " ").title()
            hpo_term = hpo_mapping.get(sym, "")
            if hpo_term:
                label += f" ({hpo_term})"
            primary_deviations.append(
                f"{label}: {z:+.1f}σ from baseline [{detail.get('interpretation','stable').upper()}]"
            )

    if not primary_deviations:
        primary_deviations = ["All symptoms within personal baseline range."]

    # ── Volatility
    volatility_statement = (
        f"Volatility Index: {volatility.get('value',0):.2f} "
        f"[{volatility.get('label','low').upper()}]"
    )

    # ── Trajectory
    slope = flare.get("slope_7d", 0.0)
    trajectory_statement = (
        f"7-day trajectory: {flare.get('acceleration_label','stable').replace('_',' ').title()} "
        f"(slope: {slope:+.2f} units/day)."
    )

    # ── Trigger
    sig_triggers = [t for t in triggers if t.get("significant")]
    if sig_triggers:
        top = sig_triggers[0]
        trigger_statement = (
            f"Primary trigger: {top['trigger'].replace('_',' ').title()} "
            f"(Spearman r={top['correlation']:.2f}, p={top['p_value']:.3f})."
        )
    else:
        trigger_statement = "No statistically significant trigger associations detected."

    # ── Functional Impact
    functional_impact_statement = (
        f"Functional Impact Score: {fis.get('composite',0):.2f} "
        f"[{fis.get('severity_label','minimal').upper()}]"
    )

    # ── Data Confidence
    confidence_statement = (
        f"Data completeness: {missingness.get('completeness_pct',0):.0f}% "
        f"({missingness.get('entries_found',0)}/{missingness.get('entries_expected',window_days)} days)."
    )

    # ── Escalation
    escalation_guidance = ESCALATION_TEMPLATES.get(
        risk,
        ESCALATION_TEMPLATES["LOW"]
    )

    # ── Base Structured Text
    structured_text = f"""
CLINICAL SIGNAL SUMMARY
Patient: {patient_id}
Disease: {disease_name}
Period: Last {window_days} days
Risk Category: {risk}

Signal Deviations:
{chr(10).join(primary_deviations)}

Trajectory:
{trajectory_statement}

Volatility:
{volatility_statement}

Trigger Associations:
{trigger_statement}

Functional Impact:
{functional_impact_statement}

Data Confidence:
{confidence_statement}

Escalation Guidance:
{escalation_guidance}

{SCOPE_DISCLAIMER}
""".strip()

    return {
        "patient_id": patient_id,
        "disease_name": disease_name,
        "period_label": f"Last {window_days} days",
        "generated_at": now,
        "primary_deviations": primary_deviations,
        "volatility_statement": volatility_statement,
        "trigger_statement": trigger_statement,
        "functional_impact_statement": functional_impact_statement,
        "confidence_statement": confidence_statement,
        "trajectory_statement": trajectory_statement,
        "risk_category": risk,
        "escalation_guidance": escalation_guidance,
        "red_flags": [rf.replace("_", " ").title() for rf in red_flags],
        "scope_disclaimer": SCOPE_DISCLAIMER,
        "structured_text": structured_text,
        "is_ai_generated": False
    }


def generate_detailed_ai_report(patient_id: str, disease_name: str, deviations: list[str]) -> str:
    """
    Takes a specific list of deviations (including HPO terms) and prompts
    Gemini to provide a complete, conversational clinician explainer report,
    while fiercely respecting the non-diagnostic scope constraint.
    """
    if not GEMINI_MODEL:
        return "AI features are disabled: GEMINI_API_KEY not configured."
    
    dev_str = "\n".join(f"- {d}" for d in deviations)
    prompt = f"""
You are an expert clinical documentation assistant.
The following is a list of active statistical signal deviations for Patient {patient_id} with {disease_name}.
These deviations map to specific Human Phenotype Ontology (HPO) terms provided in parentheses.

SIGNAL DEVIATIONS:
{dev_str}

Please generate a "Complete AI Report" elaborating on what these specific deviations, considered together,
might imply regarding the patient's current functional and physiological trajectory. 

Rules:
1. Explain the medical/physiological relevance of the provided HPO terms.
2. Synthesize how these specific deviations interact in the context of {disease_name}.
3. DO NOT DIAGNOSE, PROGNOSTICATE, OR RECOMMEND SPECIFIC LIFESTYLE/MEDICAL TREATMENTS.
4. You may suggest general clinical next steps (e.g., routine monitoring, specialist referral).
5. End EXACTLY with:
"{SCOPE_DISCLAIMER}"
"""
    try:
        response = GEMINI_MODEL.generate_content(prompt)
        if response and response.text:
            return response.text.strip()
    except Exception as e:
        return f"Failed to generate report: {str(e)}"
        
    return "Generation failed."