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
    context_statement = signals.get("context_statement")

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
    if context_statement:
        trigger_statement = f"{trigger_statement} {context_statement}"

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


# ─────────────────────────────────────────────────────────────
# Disease-Specific Recommended Tests
# ─────────────────────────────────────────────────────────────

DISEASE_RECOMMENDED_TESTS = {
    "POTS": {
        "labs": [
            {"name": "Serum Norepinephrine (standing vs supine)", "priority": "HIGH", "why": "Differentiates neuropathic from hyperadrenergic POTS subtype."},
            {"name": "Complete Blood Count (CBC)", "priority": "ROUTINE", "why": "Anaemia can mimic or worsen orthostatic intolerance."},
            {"name": "Serum Ferritin & Iron Studies", "priority": "HIGH", "why": "Iron deficiency is a common reversible POTS trigger."},
            {"name": "Thyroid Function Tests (TSH, Free T4)", "priority": "ROUTINE", "why": "Thyroid dysfunction mimics autonomic symptoms."},
            {"name": "24-Hour Urine Sodium", "priority": "WATCH", "why": "Guides salt supplementation strategy in POTS management."},
        ],
        "imaging": [
            {"name": "Echocardiogram", "priority": "ROUTINE", "why": "Excludes structural cardiac causes of tachycardia."},
            {"name": "Brain MRI (if neurological symptoms)", "priority": "WATCH", "why": "Rules out central nervous system involvement."},
        ],
        "specialist": [
            {"name": "Autonomic Neurology", "priority": "HIGH", "why": "Tilt-table test and autonomic function panel."},
            {"name": "Cardiology", "priority": "ROUTINE", "why": "Cardiac monitoring and medication management."},
        ],
        "monitoring": [
            {"name": "Active Stand Test (10-min)", "priority": "HIGH", "why": "Diagnose orthostatic HR rise ≥30 bpm criterion."},
            {"name": "Continuous HRV Monitoring", "priority": "WATCH", "why": "Track autonomic tone recovery between episodes."},
        ],
    },
    "EDS": {
        "labs": [
            {"name": "Collagen Gene Panel (COL3A1, COL5A1/2)", "priority": "HIGH", "why": "Genetic confirmation is critical for subtype classification."},
            {"name": "Skin Biopsy (electron microscopy)", "priority": "WATCH", "why": "May reveal collagen fibril abnormalities in classical EDS."},
            {"name": "CBC & CMP", "priority": "ROUTINE", "why": "Baseline metabolic panel for medication monitoring."},
        ],
        "imaging": [
            {"name": "Whole Spine MRI", "priority": "HIGH", "why": "Detect craniocervical instability and tethered cord."},
            {"name": "Echocardiogram + Aortic Root Measurement", "priority": "HIGH", "why": "Vascular EDS (vEDS) carries aortic rupture risk."},
            {"name": "X-ray joints (hands, knees, hips)", "priority": "ROUTINE", "why": "Assess joint degeneration trajectory."},
        ],
        "specialist": [
            {"name": "Medical Genetics", "priority": "HIGH", "why": "Subtype confirmation and family risk counselling."},
            {"name": "Rheumatology", "priority": "ROUTINE", "why": "Joint management and pain protocol."},
            {"name": "Physical Therapy (connective tissue specialist)", "priority": "HIGH", "why": "Stabilisation programme to reduce subluxation frequency."},
        ],
        "monitoring": [
            {"name": "Beighton Score Assessment (annual)", "priority": "ROUTINE", "why": "Track hypermobility changes over time."},
        ],
    },
    "FMF": {
        "labs": [
            {"name": "MEFV Gene Sequencing", "priority": "HIGH", "why": "Diagnostic confirmation of FMF mutations (M694V, M680I, V726A)."},
            {"name": "Serum Amyloid A (SAA)", "priority": "HIGH", "why": "Elevated SAA predicts amyloidosis risk; guides colchicine dosing."},
            {"name": "ESR & CRP", "priority": "ROUTINE", "why": "Inflammatory markers during and between episodes."},
            {"name": "Urinalysis & Urine Protein/Creatinine", "priority": "HIGH", "why": "Proteinuria signals early renal amyloidosis."},
            {"name": "Complete Blood Count", "priority": "ROUTINE", "why": "Monitor for leucocytosis during acute attacks."},
        ],
        "imaging": [
            {"name": "Abdominal Ultrasound", "priority": "WATCH", "why": "Assess spleen size and hepatic involvement."},
            {"name": "Joint X-ray (if arthritis present)", "priority": "WATCH", "why": "Evaluate destructive joint changes in FMF arthropathy."},
        ],
        "specialist": [
            {"name": "Rheumatology", "priority": "HIGH", "why": "Colchicine titration and biologics (IL-1 inhibitors) if refractory."},
            {"name": "Nephrology", "priority": "WATCH", "why": "If proteinuria or renal amyloidosis suspected."},
        ],
        "monitoring": [
            {"name": "Diurnal Body Temp Diary", "priority": "HIGH", "why": "Confirms febrile attack periodicity for diagnosis and colchicine response."},
        ],
    },
    "CF": {
        "labs": [
            {"name": "Sweat Chloride Test (Pilocarpine iontophoresis)", "priority": "HIGH", "why": "Gold standard diagnostic test; >60 mEq/L diagnostic of CF."},
            {"name": "CFTR Mutation Panel", "priority": "HIGH", "why": "Guides eligibility for CFTR modulators (ivacaftor, elexacaftor)."},
            {"name": "Sputum Culture & Sensitivity", "priority": "HIGH", "why": "Identify chronic colonisers (Pseudomonas, MRSA) for antibiotic tailoring."},
            {"name": "HbA1c + Oral Glucose Tolerance Test", "priority": "ROUTINE", "why": "CF-related diabetes (CFRD) develops in ~20% of adults."},
            {"name": "Liver Function Tests", "priority": "ROUTINE", "why": "CF liver disease affects ~10–30% of patients."},
        ],
        "imaging": [
            {"name": "Chest CT (High Resolution)", "priority": "HIGH", "why": "Bronchiectasis, mucus plugging, and air trapping quantification."},
            {"name": "Abdominal Ultrasound (annual)", "priority": "ROUTINE", "why": "Liver involvement and portal hypertension surveillance."},
        ],
        "specialist": [
            {"name": "CF Specialist Centre", "priority": "HIGH", "why": "Multidisciplinary team: pulmonology, dietitian, physiotherapy, psychology."},
            {"name": "Endocrinology", "priority": "WATCH", "why": "For CFRD management and bone mineral density."},
        ],
        "monitoring": [
            {"name": "Spirometry (FEV₁, FVC) every 3 months", "priority": "HIGH", "why": "Primary lung function endpoint for disease progression and treatment response."},
            {"name": "6-Minute Walk Test", "priority": "ROUTINE", "why": "Functional exercise capacity proxy for exacerbation prediction."},
            {"name": "Pulse Oximetry (home monitoring)", "priority": "HIGH", "why": "Early detection of SpO₂ desaturation before clinical deterioration."},
        ],
    },
    "SMA": {
        "labs": [
            {"name": "SMN1 Gene Deletion Analysis", "priority": "HIGH", "why": "Confirms SMA; SMN2 copy number guides prognosis and treatment eligibility."},
            {"name": "SMN2 Copy Number Quantification", "priority": "HIGH", "why": "Higher copy number correlates with milder phenotype; affects nusinersen dosing."},
            {"name": "Creatine Kinase (CK)", "priority": "ROUTINE", "why": "Mildly elevated in SMA; excludes muscular dystrophy."},
            {"name": "Pulmonary Function Tests (spirometry + MIP/MEP)", "priority": "HIGH", "why": "Tracks respiratory muscle involvement."},
        ],
        "imaging": [
            {"name": "Spine MRI & X-ray (scoliosis surveillance)", "priority": "HIGH", "why": "Progressive scoliosis is common in non-ambulatory SMA patients."},
            {"name": "Chest X-ray (annual)", "priority": "ROUTINE", "why": "Assess for aspiration pneumonia and diaphragmatic changes."},
        ],
        "specialist": [
            {"name": "Neuromuscular Specialist", "priority": "HIGH", "why": "Nusinersen, risdiplam, or gene therapy (onasemnogene) eligibility assessment."},
            {"name": "Pulmonology / Respiratory", "priority": "HIGH", "why": "NIV (BiPAP) initiation threshold monitoring."},
            {"name": "Nutritional Support / Dietitian", "priority": "ROUTINE", "why": "SMA patients have increased malnutrition risk from swallowing difficulties."},
        ],
        "monitoring": [
            {"name": "Hammersmith Functional Motor Scale (HFMS)", "priority": "HIGH", "why": "Standardised motor function score for SMA clinical tracking."},
            {"name": "Overnight Pulse Oximetry", "priority": "HIGH", "why": "Detect nocturnal hypoventilation before daytime symptoms emerge."},
        ],
    },
    "MFS": {
        "labs": [
            {"name": "FBN1 Gene Sequencing", "priority": "HIGH", "why": "Identifies fibrillin-1 mutations confirming Marfan syndrome."},
            {"name": "TGF-β Serum Level (research context)", "priority": "WATCH", "why": "Elevated TGF-β signalling correlates with aortic progression in MFS."},
        ],
        "imaging": [
            {"name": "Transthoracic Echocardiogram (annual)", "priority": "HIGH", "why": "Aortic root Z-score measurement — triggers surgery threshold at ≥5 cm."},
            {"name": "Aortic MRI/CT Angiography", "priority": "HIGH", "why": "Full aortic anatomy beyond echo windows; Z-score surveillance."},
            {"name": "Slit-lamp Eye Exam (annual)", "priority": "HIGH", "why": "Ectopia lentis is present in 60% of MFS — assess for lens dislocation."},
            {"name": "Spine MRI", "priority": "WATCH", "why": "Dural ectasia and lumbar involvement."},
        ],
        "specialist": [
            {"name": "Cardiothoracic Surgery", "priority": "HIGH", "why": "Elective aortic root repair planning; beta-blocker or losartan therapy."},
            {"name": "Ophthalmology (annual)", "priority": "HIGH", "why": "Retinal detachment and lens dislocation surveillance."},
            {"name": "Orthopaedic Surgery", "priority": "WATCH", "why": "Scoliosis surgical evaluation if Cobb angle > 40°."},
        ],
        "monitoring": [
            {"name": "Blood Pressure Monitoring (home)", "priority": "HIGH", "why": "Beta-blocker therapy response; keep systolic <110 mmHg."},
        ],
    },
    "HD": {
        "labs": [
            {"name": "HTT Gene CAG Repeat Length", "priority": "HIGH", "why": "CAG ≥36 confirms HD; repeat length predicts age of onset (longer = earlier)."},
            {"name": "Metabolic Panel + Liver Function", "priority": "ROUTINE", "why": "Baseline before initiating tetrabenazine / deutetrabenazine."},
            {"name": "TSH & Fasting Glucose", "priority": "ROUTINE", "why": "Metabolic comorbidities affect HD progression and management."},
        ],
        "imaging": [
            {"name": "Brain MRI (volumetric)", "priority": "HIGH", "why": "Caudate nucleus atrophy is the HD imaging hallmark; track progression."},
            {"name": "Brain PET (dopamine imaging)", "priority": "WATCH", "why": "Striatal dopamine depletion correlates with chorea severity."},
        ],
        "specialist": [
            {"name": "Neurologist (HD Specialist Centre)", "priority": "HIGH", "why": "Chorea management: tetrabenazine, deutetrabenazine, or valbenazine initiation."},
            {"name": "Psychiatry", "priority": "HIGH", "why": "Depression and anxiety are leading causes of HD-related morbidity; treat early."},
            {"name": "Speech & Language Therapy", "priority": "ROUTINE", "why": "Dysarthria and dysphagia management before swallowing becomes dangerous."},
            {"name": "Genetic Counselling", "priority": "HIGH", "why": "Autosomal dominant inheritance; predictive testing for at-risk relatives."},
        ],
        "monitoring": [
            {"name": "Unified Huntington's Disease Rating Scale (UHDRS)", "priority": "HIGH", "why": "Gold standard functional and motor score for HD progression."},
        ],
    },
    "RTT": {
        "labs": [
            {"name": "MECP2 Gene Sequencing & Deletion Analysis", "priority": "HIGH", "why": "Confirms Rett syndrome; >95% of classic RTT have MECP2 mutations."},
            {"name": "EEG", "priority": "HIGH", "why": "Seizures occur in 80% of RTT patients; EEG type guides anti-epileptic selection."},
            {"name": "Bone Density (DXA Scan)", "priority": "ROUTINE", "why": "Osteoporosis is common from immobility and anti-epileptic drugs."},
            {"name": "Thyroid Function Tests", "priority": "ROUTINE", "why": "Baseline and monitoring for hypothyroidism."},
        ],
        "imaging": [
            {"name": "Cardiac ECG (QTc)", "priority": "HIGH", "why": "RTT has high SUDEP risk; prolonged QTc must be identified and managed."},
            {"name": "Spine X-ray (scoliosis)", "priority": "HIGH", "why": "Progressive scoliosis is near-universal; Cobb angle tracks surgical threshold."},
        ],
        "specialist": [
            {"name": "Paediatric Neurology / RTT Specialist", "priority": "HIGH", "why": "Anti-epileptic optimisation and trofinetide (daybue) eligibility."},
            {"name": "Cardiology", "priority": "HIGH", "why": "QTc monitoring and cardiac event risk stratification."},
            {"name": "Orthopaedic Surgery", "priority": "WATCH", "why": "Scoliosis intervention assessment."},
        ],
        "monitoring": [
            {"name": "RTT Clinical Severity Scale", "priority": "HIGH", "why": "Tracks regression phase vs stabilisation over time."},
        ],
    },
    "PKU": {
        "labs": [
            {"name": "Plasma Phenylalanine Level (Phe)", "priority": "HIGH", "why": "Target: <360 μmol/L; the primary treatment monitoring metric."},
            {"name": "Tetrahydrobiopterin (BH4) Loading Test", "priority": "HIGH", "why": "Identifies BH4-responsive PKU (sapropterin eligibility)."},
            {"name": "PAH Gene Mutation Analysis", "priority": "HIGH", "why": "Genotype-phenotype correlation; guides dietary restriction intensity."},
            {"name": "Plasma Amino Acid Profile", "priority": "ROUTINE", "why": "Complete amino acid nutritional status monitoring."},
            {"name": "Bone Density (DXA)", "priority": "ROUTINE", "why": "Low Phe diets can compromise bone mineralisation."},
        ],
        "imaging": [
            {"name": "Brain MRI (T2 white matter changes)", "priority": "HIGH", "why": "White matter signal abnormalities reflect Phe neurotoxicity; reversible with control."},
        ],
        "specialist": [
            {"name": "Metabolic Dietitian", "priority": "HIGH", "why": "Precise Phe tolerance calculation and protein equivalent formulation."},
            {"name": "Paediatric Metabolic Medicine", "priority": "HIGH", "why": "Sapropterin, pegvaliase, or dietary adjustment."},
            {"name": "Neuropsychology", "priority": "WATCH", "why": "Cognitive and executive function testing in adolescents/adults."},
        ],
        "monitoring": [
            {"name": "Dried Blood Spot (DBS) Phe Monthly", "priority": "HIGH", "why": "Home monitoring for dietary adherence and dose adjustment."},
        ],
    },
    "WD": {
        "labs": [
            {"name": "Serum Ceruloplasmin", "priority": "HIGH", "why": "<0.2 g/L is strongly suggestive of Wilson disease."},
            {"name": "24-Hour Urine Copper", "priority": "HIGH", "why": ">100 μg/24h confirms copper overload; tracks treatment response."},
            {"name": "Liver Copper Quantification (biopsy)", "priority": "HIGH", "why": "Gold standard; >250 μg/g dry weight is diagnostic."},
            {"name": "ATP7B Gene Sequencing", "priority": "HIGH", "why": "Confirms WD diagnosis and enables family screening."},
            {"name": "Liver Function Tests (LFTs)", "priority": "ROUTINE", "why": "Monitor hepatic injury and treatment response."},
        ],
        "imaging": [
            {"name": "Brain MRI (T2/FLAIR)", "priority": "HIGH", "why": "Basal ganglia and putamen signal changes in neurological WD."},
            {"name": "Liver Ultrasound / FibroScan", "priority": "HIGH", "why": "Hepatic fibrosis staging and cirrhosis surveillance."},
        ],
        "specialist": [
            {"name": "Hepatology", "priority": "HIGH", "why": "D-penicillamine, trientine, or zinc therapy and liver transplant evaluation."},
            {"name": "Neurology", "priority": "HIGH", "why": "Tremor, dysarthria, psychiatric symptoms management."},
            {"name": "Ophthalmology (slit-lamp)", "priority": "HIGH", "why": "Kayser-Fleischer ring detection and resolution monitoring."},
        ],
        "monitoring": [
            {"name": "24-Hour Urine Copper (quarterly)", "priority": "HIGH", "why": "Primary chelation therapy monitoring metric."},
        ],
    },
    "Gaucher": {
        "labs": [
            {"name": "Beta-Glucocerebrosidase Enzyme Activity (leukocytes/DBS)", "priority": "HIGH", "why": "<30% of mean confirms Gaucher disease."},
            {"name": "GBA Gene Sequencing", "priority": "HIGH", "why": "Identifies mutation type; N370S associated with Type 1 (non-neuronopathic)."},
            {"name": "Chitotriosidase & Glucosylsphingosine (lyso-GL1)", "priority": "HIGH", "why": "Biomarkers of disease burden and ERT response."},
            {"name": "CBC with Differential", "priority": "HIGH", "why": "Thrombocytopenia and anaemia are key disease manifestations."},
            {"name": "Bone Marrow MRI Scoring (BMB/BML)", "priority": "WATCH", "why": "Marrow infiltration correlates with bone crisis risk."},
        ],
        "imaging": [
            {"name": "MRI Abdomen (liver & spleen volume)", "priority": "HIGH", "why": "Organomegaly quantification for ERT dosing and response."},
            {"name": "Bone DEXA & X-ray", "priority": "HIGH", "why": "Avascular necrosis and osteoporosis surveillance."},
        ],
        "specialist": [
            {"name": "Lysosomal Storage Disease Specialist", "priority": "HIGH", "why": "ERT (imiglucerase/velaglucerase) or SRT (eliglustat) selection and monitoring."},
            {"name": "Haematology", "priority": "HIGH", "why": "Thrombocytopenia management and splenic decision-making."},
        ],
        "monitoring": [
            {"name": "Gaucher Disease Type 1 Severity Score (DS3)", "priority": "HIGH", "why": "Composite scoring tool for ERT response tracking."},
        ],
    },
    "NF1": {
        "labs": [
            {"name": "NF1 Gene Sequencing & MLPA", "priority": "HIGH", "why": "Confirms diagnosis; genotype-phenotype correlation emerging for tumour risk."},
            {"name": "Ophthalmology (Lisch nodules, optic glioma)", "priority": "HIGH", "why": "Annual slit-lamp and visual evoked potentials for optic pathway involvement."},
        ],
        "imaging": [
            {"name": "Brain & Spine MRI (annual in children)", "priority": "HIGH", "why": "Optic glioma, brainstem glioma, and FASI (UBOs) surveillance."},
            {"name": "Whole-body MRI", "priority": "WATCH", "why": "Plexiform neurofibroma volumetry and malignant transformation detection."},
            {"name": "PET-CT (FDG)", "priority": "WATCH", "why": "Differentiates benign plexiform from MPNST (malignant transition)."},
        ],
        "specialist": [
            {"name": "NF Specialist Centre / Neuro-oncology", "priority": "HIGH", "why": "Selumetinib eligibility and plexiform management."},
            {"name": "Neurosurgery", "priority": "WATCH", "why": "Surgical planning for symptomatic or rapidly growing lesions."},
            {"name": "Orthopaedics", "priority": "WATCH", "why": "Pseudarthrosis, scoliosis, and tibial bowing."},
        ],
        "monitoring": [
            {"name": "Blood Pressure (annual)", "priority": "HIGH", "why": "Hypertension from renal artery stenosis or phaeochromocytoma screening."},
        ],
    },
    "FXS": {
        "labs": [
            {"name": "FMR1 CGG Repeat Analysis", "priority": "HIGH", "why": "CGG >200 = full mutation (FXS); 55–200 = premutation (FXTAS/FXPOI risk)."},
            {"name": "FMRP Protein Level (lymphocytes)", "priority": "HIGH", "why": "Correlates with IQ and symptom severity; 0% in full methylation."},
            {"name": "Karyotype / Chromosomal Microarray", "priority": "WATCH", "why": "Rule out co-existing chromosomal conditions."},
        ],
        "imaging": [
            {"name": "Brain MRI (caudate, cerebellar volume)", "priority": "WATCH", "why": "White matter and cerebellar changes in FXS and FXTAS premutation carriers."},
            {"name": "Cardiac Echo", "priority": "ROUTINE", "why": "Mitral valve prolapse occurs in ~50% of adult males with FXS."},
        ],
        "specialist": [
            {"name": "Developmental Paediatrics / Genetics", "priority": "HIGH", "why": "Behaviour and cognitive intervention planning."},
            {"name": "Psychiatry", "priority": "HIGH", "why": "ADHD, anxiety, and ASD comorbidity management."},
            {"name": "Genetic Counselling", "priority": "HIGH", "why": "X-linked inheritance; female carriers at FXPOI and FXTAS risk."},
        ],
        "monitoring": [
            {"name": "Mullen Scales / Vineland Adaptive Behaviour Scales", "priority": "HIGH", "why": "Track developmental trajectory and intervention response."},
        ],
    },
    "PCD": {
        "labs": [
            {"name": "Nasal Nitric Oxide (nNO)", "priority": "HIGH", "why": "Very low nNO (<77 nL/min) is a sensitive PCD screening test."},
            {"name": "Ciliary Electron Microscopy (TEM)", "priority": "HIGH", "why": "Identifies specific dynein arm defects and structural mutations."},
            {"name": "DNAI1 / DNAH5 / CCDC39/40 Gene Panel", "priority": "HIGH", "why": "Common PCD mutations; guides prognosis and family testing."},
            {"name": "Sputum Culture", "priority": "HIGH", "why": "Identifies chronic colonisers (H. influenzae, Strep pneumoniae, Pseudomonas)."},
        ],
        "imaging": [
            {"name": "High-Resolution CT Chest", "priority": "HIGH", "why": "Bronchiectasis distribution and severity as primary lung disease marker."},
            {"name": "Situs Assessment (chest X-ray / echo)", "priority": "HIGH", "why": "Situs inversus in ~50% of PCD (Kartagener syndrome)."},
            {"name": "Sinus CT", "priority": "ROUTINE", "why": "Chronic rhino-sinusitis management and surgical planning."},
        ],
        "specialist": [
            {"name": "Respiratory / PCD Centre", "priority": "HIGH", "why": "Airway clearance programme and spirometry."},
            {"name": "ENT", "priority": "HIGH", "why": "Chronic otitis media, hearing loss, and sinusitis management."},
        ],
        "monitoring": [
            {"name": "Spirometry (annual)", "priority": "HIGH", "why": "FEV₁ decline is the primary lung function progression marker."},
        ],
    },
    "Heterotaxy": {
        "labs": [
            {"name": "Complete Blood Count (post-splenectomy or asplenia)", "priority": "HIGH", "why": "Howell-Jolly bodies and thrombocytosis confirm functional asplenia."},
            {"name": "Vaccination Status Review", "priority": "HIGH", "why": "Asplenic patients need pneumococcal, meningococcal, Hib vaccines."},
            {"name": "Genetic Panel (NODAL, ZIC3, CFC1, LEFTB)", "priority": "WATCH", "why": "Identifies underlying laterality defect gene for family counselling."},
        ],
        "imaging": [
            {"name": "Cardiac MRI (anatomy + haemodynamics)", "priority": "HIGH", "why": "Complex CHD anatomy requires volumetric MRI for surgical planning."},
            {"name": "Liver/Spleen Ultrasound", "priority": "HIGH", "why": "Multi-spleen (polysplenia) or absent spleen (asplenia) confirmation."},
        ],
        "specialist": [
            {"name": "Paediatric Cardiology / CHD Centre", "priority": "HIGH", "why": "Fontan, Glenn, or repair surgery planning and follow-up."},
            {"name": "Hepatology (Fontan-associated liver disease)", "priority": "HIGH", "why": "Hepatic venous congestion and fibrosis from elevated central venous pressure."},
        ],
        "monitoring": [
            {"name": "Cardiac Catheterisation (Fontan patients)", "priority": "HIGH", "why": "Circuit pressure assessment every 3–5 years."},
            {"name": "Pulse Oximetry (home)", "priority": "HIGH", "why": "SpO₂ <85% or acute drop triggers urgent evaluation."},
        ],
    },
    "Pompe": {
        "labs": [
            {"name": "Acid Alpha-Glucosidase (GAA) Enzyme Activity", "priority": "HIGH", "why": "Confirms Pompe disease; <1% in classic infantile; 1–30% in late-onset."},
            {"name": "GAA Gene Sequencing (dual mutations)", "priority": "HIGH", "why": "Confirms diagnosis; c.-32-13T>G variant most common in late-onset."},
            {"name": "Anti-rhGAA Antibody Titre (CRIM status)", "priority": "HIGH", "why": "CRIM-negative patients need immunomodulation before ERT to prevent antibody formation."},
            {"name": "CK, LDH, ALT, AST (liver panel)", "priority": "ROUTINE", "why": "Muscle and hepatic enzyme elevation in Pompe."},
            {"name": "Pulmonary Function Tests (FVC, MIP, MEP)", "priority": "HIGH", "why": "Respiratory function is the primary mortality predictor."},
        ],
        "imaging": [
            {"name": "Muscle MRI (lower limb)", "priority": "HIGH", "why": "Pattern of paraspinal and thigh involvement guides physiotherapy."},
            {"name": "Echocardiogram (infantile)", "priority": "HIGH", "why": "Hypertrophic cardiomyopathy is the classic infantile Pompe finding."},
        ],
        "specialist": [
            {"name": "Neuromuscular / Lysosomal Storage Specialist", "priority": "HIGH", "why": "Alglucosidase alfa (ERT) or cipaglucosidase + miglustat initiation."},
            {"name": "Pulmonology", "priority": "HIGH", "why": "NIV threshold monitoring and assisted cough protocol."},
        ],
        "monitoring": [
            {"name": "6-Minute Walk Test (6MWT)", "priority": "HIGH", "why": "Primary ERT response endpoint in late-onset Pompe."},
            {"name": "Rotterdam Handicap Scale", "priority": "ROUTINE", "why": "Disability staging tool for Pompe."},
        ],
    },
    "TS": {
        "labs": [
            {"name": "Karyotype (peripheral blood)", "priority": "HIGH", "why": "45,X classic Turner; mosaicism common — karyotype 30 cells minimum."},
            {"name": "Echocardiogram + Aortic Z-score", "priority": "HIGH", "why": "Bicuspid aortic valve (~50%) and coarctation (~10%) are the primary cardiac risks."},
            {"name": "FSH & LH", "priority": "HIGH", "why": "Elevated gonadotrophins confirm primary ovarian insufficiency."},
            {"name": "Thyroid Function Tests (TSH, anti-TPO)", "priority": "HIGH", "why": "Autoimmune thyroiditis occurs in 30–50% of Turner syndrome."},
            {"name": "Liver Function & Lipid Panel", "priority": "ROUTINE", "why": "Fatty liver and dyslipidaemia are common metabolic complications."},
        ],
        "imaging": [
            {"name": "Aortic MRI (annual in adults)", "priority": "HIGH", "why": "Aortic size index (ASI) ≥2.5 cm/m² triggers surgical review."},
            {"name": "Renal Ultrasound", "priority": "HIGH", "why": "Horseshoe kidney and ureteropelvic junction abnormalities in ~30%."},
            {"name": "Bone Density (DXA)", "priority": "ROUTINE", "why": "Oestrogen deficiency causes accelerated bone loss."},
        ],
        "specialist": [
            {"name": "Paediatric Endocrinology", "priority": "HIGH", "why": "Growth hormone and oestrogen replacement therapy."},
            {"name": "Cardiothoracic Surgery / Cardiology", "priority": "HIGH", "why": "Valve repair/replacement and aortic root surveillance."},
            {"name": "Reproductive Endocrinology", "priority": "HIGH", "why": "Fertility preservation counselling where applicable."},
        ],
        "monitoring": [
            {"name": "Blood Pressure (annual)", "priority": "HIGH", "why": "Hypertension risk from coarctation and aortic pathology."},
        ],
    },
    "Alkaptonuria": {
        "labs": [
            {"name": "Urine Homogentisic Acid (HGA) — 24-hour", "priority": "HIGH", "why": ">1 mmol/mmol creatinine is diagnostic; tracks nitisinone response."},
            {"name": "HGD Gene Sequencing", "priority": "HIGH", "why": "Confirms AKU; compound heterozygotes most common."},
            {"name": "Serum & Urine Tyrosine", "priority": "HIGH", "why": "Tyrosine elevation is a nitisinone side-effect requiring dietary adjustment."},
            {"name": "Inflammatory Markers (CRP, ESR)", "priority": "ROUTINE", "why": "Ochronotic arthropathy flares correlate with inflammatory markers."},
        ],
        "imaging": [
            {"name": "Spine MRI & X-ray", "priority": "HIGH", "why": "Ochronotic disc calcification and vertebral collapse — lumbar most affected."},
            {"name": "Hip & Knee X-ray", "priority": "HIGH", "why": "Ochronotic joint destruction pattern differs from OA; asymmetric."},
            {"name": "Cardiac Echo + ECG", "priority": "HIGH", "why": "Aortic valve calcification and conduction defects from ochronosis."},
        ],
        "specialist": [
            {"name": "Metabolic Medicine", "priority": "HIGH", "why": "Nitisinone initiation (LOOP Trial-supported) and dietary tyrosine control."},
            {"name": "Orthopaedic Surgery", "priority": "HIGH", "why": "Joint replacement planning; earlier than typical OA."},
        ],
        "monitoring": [
            {"name": "Urine HGA (every 6 months on nitisinone)", "priority": "HIGH", "why": "Confirms adequate HGA suppression."},
        ],
    },
    "Achondroplasia": {
        "labs": [
            {"name": "FGFR3 Gene Analysis (p.Gly380Arg)", "priority": "HIGH", "why": "97% of achondroplasia caused by this single FGFR3 gain-of-function variant."},
            {"name": "Sleep Polysomnography", "priority": "HIGH", "why": "Central + obstructive sleep apnoea is common in infants from foramen magnum stenosis."},
        ],
        "imaging": [
            {"name": "Cranial MRI (foramen magnum)", "priority": "HIGH", "why": "Severe stenosis causing apnoea or myelopathy requires decompression."},
            {"name": "Spine MRI (lumbar spinal stenosis)", "priority": "HIGH", "why": "Progressive stenosis in adults — monitor walking distance and bladder symptoms."},
            {"name": "Lower limb X-ray", "priority": "ROUTINE", "why": "Bowing correction planning."},
        ],
        "specialist": [
            {"name": "Paediatric Neurosurgery", "priority": "HIGH", "why": "Foramen magnum decompression if critical stenosis."},
            {"name": "Endocrinology (paediatric)", "priority": "HIGH", "why": "Vosoritide (CNP analogue) eligibility — approved for children ≥2 years."},
            {"name": "ENT + Audiologist", "priority": "ROUTINE", "why": "Ear tube insertion for chronic otitis media (very common)."},
        ],
        "monitoring": [
            {"name": "Height Velocity (6-monthly)", "priority": "HIGH", "why": "Primary vosoritide response endpoint."},
            {"name": "SpO₂ monitoring (infants)", "priority": "HIGH", "why": "Apnoea-related desaturation can be life-threatening in first 2 years."},
        ],
    },
    "RRP": {
        "labs": [
            {"name": "HPV Typing (6 & 11)", "priority": "HIGH", "why": "HPV-11 associated with more aggressive disease and pulmonary spread."},
            {"name": "Pulmonary Function Tests", "priority": "ROUTINE", "why": "Baseline for patients with glottic involvement and hoarseness."},
            {"name": "CBC & CMP (pre-systemic therapy)", "priority": "ROUTINE", "why": "Baseline before bevacizumab or cidofovir."},
        ],
        "imaging": [
            {"name": "CT Chest", "priority": "HIGH", "why": "Pulmonary spread is life-threatening; cystic/nodular lesions specific to RRP."},
            {"name": "Laryngoscopy / Microlaryngoscopy", "priority": "HIGH", "why": "Primary diagnostic and surgical tool; tracks papilloma burden."},
        ],
        "specialist": [
            {"name": "Laryngologist / ENT Surgeon", "priority": "HIGH", "why": "Surgical debulking (microlaryngoscopy, ablation) — typically repeated."},
            {"name": "Pulmonology", "priority": "HIGH", "why": "For pulmonary RRP — bevacizumab or anti-VEGF therapy."},
            {"name": "Oncology", "priority": "WATCH", "why": "Malignant transformation risk is low but real, especially HPV-11."},
        ],
        "monitoring": [
            {"name": "Derkay Staging Score", "priority": "HIGH", "why": "Standardised papilloma burden tool tracking surgical interval need."},
        ],
    },
    "ENS": {
        "labs": [
            {"name": "Full GI Motility Panel (gastric emptying scintigraphy)", "priority": "HIGH", "why": "Confirms gastroparesis and quantifies delay."},
            {"name": "Autonomic Nerve Testing (QSART, thermoregulatory sweat test)", "priority": "HIGH", "why": "Identifies autonomic neuropathy contribution to ENS."},
            {"name": "Anti-neuron Antibodies (anti-Hu, ANNA-1)", "priority": "WATCH", "why": "Rules out paraneoplastic ENS; crucial in older patients."},
            {"name": "Thyroid, B12, Heavy Metal Screen", "priority": "ROUTINE", "why": "Reversible causes of neuropathic ENS must be excluded first."},
        ],
        "imaging": [
            {"name": "Upper GI Endoscopy", "priority": "HIGH", "why": "Assesses mucosal integrity; rules out mechanical obstruction."},
            {"name": "MRI Enterography", "priority": "WATCH", "why": "Small bowel morphology and motility in suspected dysmotility."},
        ],
        "specialist": [
            {"name": "Neurogastroenterology", "priority": "HIGH", "why": "Comprehensive GI motility evaluation and neuro-enteric programme."},
            {"name": "Autonomic Neurology", "priority": "HIGH", "why": "ENS often overlaps with systemic dysautonomia management."},
        ],
        "monitoring": [
            {"name": "GI Symptom Rating Scale (GSRS)", "priority": "HIGH", "why": "Standardised self-report tool tracking motility symptom burden."},
        ],
    },
    "PRION": {
        "labs": [
            {"name": "CSF Real-Time Quaking-Induced Conversion (RT-QuIC)", "priority": "HIGH", "why": "Highly sensitive/specific prion biomarker; positive in CJD."},
            {"name": "CSF 14-3-3 Protein, Tau, NSE", "priority": "HIGH", "why": "Elevated in rapidly progressive neurodegeneration."},
            {"name": "PRNP Gene Sequencing", "priority": "HIGH", "why": "Diagnoses genetic prion diseases (gCJD, FFI, GSS); identifies codon 129 polymorphism."},
            {"name": "CSF Alpha-synuclein, Aβ42, p-tau", "priority": "WATCH", "why": "Helps differentiate from other rapidly progressive dementias."},
        ],
        "imaging": [
            {"name": "Brain MRI (DWI / FLAIR)", "priority": "HIGH", "why": "Cortical ribboning and basal ganglia DWI signal is characteristic of CJD."},
            {"name": "FDG-PET Brain", "priority": "WATCH", "why": "Hypometabolism pattern helps subtype classification."},
        ],
        "specialist": [
            {"name": "Prion Disease / Neurology Specialist Centre", "priority": "HIGH", "why": "UK/US national prion surveillance referral for diagnostic confirmation."},
            {"name": "Palliative Care", "priority": "HIGH", "why": "Early goals-of-care conversations are essential given rapid progression."},
            {"name": "Genetic Counselling", "priority": "HIGH", "why": "Genetic prion variants carry 50% inheritance risk; screening of family members."},
        ],
        "monitoring": [
            {"name": "EEG (periodic sharp wave complexes)", "priority": "HIGH", "why": "Characteristic EEG pattern in sporadic CJD; evolves over time."},
        ],
    },
}


# ─────────────────────────────────────────────────────────────
# Patient-Friendly Health Report Generator (Gemini + Fallback)
# ─────────────────────────────────────────────────────────────

def generate_health_report(
    patient_id: str,
    disease: str,
    disease_name: str,
    signals: Dict,
    risk_data: Dict,
    window_days: int = 7
) -> Dict:
    """
    Generate a structured patient-friendly health report with:
    - Disease-specific recommended tests (static, evidence-based)
    - Gemini-generated plain-English health summary (with structured fallback)
    Returns a dict ready for the frontend to render.
    """
    now = datetime.utcnow()
    risk = signals.get("risk_category", "INSUFFICIENT_DATA")
    z_scores = signals.get("z_scores", {})
    fis = signals.get("functional_impact", {})
    red_flags = signals.get("red_flags", [])
    forecast = risk_data.get("forecast_3d", [])
    risk_probs = risk_data.get("risk_probabilities", {})

    # ── Section 1: Recommended Tests
    tests = DISEASE_RECOMMENDED_TESTS.get(disease, {})

    # ── Section 2: Build signal context for Gemini prompt
    top_deviations = []
    for sym, detail in sorted(z_scores.items(), key=lambda x: abs(x[1].get("z_score", 0)), reverse=True)[:4]:
        z = detail.get("z_score", 0.0)
        if abs(z) >= 1.0:
            label = sym.replace("_", " ").title()
            top_deviations.append(f"{label}: {z:+.1f}σ from baseline")

    fis_composite = fis.get("composite", 0)
    mobility_score = round(fis.get("mobility", 0) * 100)
    sleep_score = round(fis.get("sleep", 0) * 100)
    cognitive_score = round(fis.get("cognitive", 0) * 100)

    dominant_risk = max(risk_probs.items(), key=lambda x: x[1])[0] if risk_probs else risk
    forecast_trend = ""
    if forecast:
        if forecast[-1] > forecast[0]:
            forecast_trend = "slight upward risk trend over the next 3 days"
        elif forecast[-1] < forecast[0]:
            forecast_trend = "improving risk trend over the next 3 days"
        else:
            forecast_trend = "stable risk trend over the next 3 days"

    # ── Section 3: Gemini-powered patient summary
    ai_summary = None
    is_ai = False

    if GEMINI_MODEL and top_deviations:
        dev_str = "\n".join(f"- {d}" for d in top_deviations)
        prompt = f"""You are a compassionate medical communication assistant helping patients with {disease_name} understand their recent symptom signal data in plain, reassuring language. 

Patient Data Summary:
- Disease: {disease_name}
- Monitoring Period: Last {window_days} days
- Risk Category: {dominant_risk}
- Top signal deviations from personal baseline:
{dev_str}
- Functional Impact Score: {round(fis_composite * 100)}% (Mobility: {mobility_score}%, Sleep: {sleep_score}%, Cognitive: {cognitive_score}%)
- Red Flags Detected: {', '.join(red_flags) if red_flags else 'None'}
- Short-term forecast: {forecast_trend}

Your task:
1. Write a warm, clear, 3–4 paragraph health summary for the PATIENT (not the doctor).
2. Explain what their signals mean in simple terms relevant to {disease_name}.
3. Give 2–3 practical self-care suggestions appropriate for {disease_name} patients (general wellness only — no specific medical advice).
4. Highlight any areas where talking to their doctor soon would be helpful.
5. MUST end with exactly: "Note: This summary is generated by an AI assistant to help you understand your data. It does not replace medical advice from your care team."

Write in a warm, supportive tone. Avoid jargon. Keep each paragraph concise."""
        try:
            response = GEMINI_MODEL.generate_content(prompt)
            if response and response.text:
                ai_summary = response.text.strip()
                is_ai = True
        except Exception as e:
            ai_summary = None

    # ── Section 4: Structured fallback summary
    if not ai_summary:
        risk_messages = {
            "LOW": "Your symptom signals are largely within your personal baseline range. Keep up with regular monitoring and self-care routines.",
            "MODERATE": "Some of your symptom signals have risen moderately above your personal baseline. This is worth discussing at your next appointment.",
            "HIGH": "Several symptom signals are elevated above your personal baseline. We recommend contacting your care team soon to review your recent data.",
            "CRITICAL": "Your symptom signals show significant elevation. Please contact your care team promptly — this is not an emergency alert, but a recommendation to seek review.",
            "INSUFFICIENT_DATA": "You don't have enough logged data yet for a full signal analysis. Try to log symptoms daily for a more accurate picture.",
        }
        dev_text = (
            f"Your top signal changes: {', '.join(top_deviations[:2])}. " if top_deviations
            else "All signals appear near your personal baseline."
        )
        fi_text = (
            f"Your functional impact score is {round(fis_composite * 100)}%, "
            f"with {['mobility', 'sleep', 'cognitive'][([mobility_score, sleep_score, cognitive_score].index(max(mobility_score, sleep_score, cognitive_score)))]} "
            f"as the most affected domain."
            if fis_composite > 0 else ""
        )
        ai_summary = (
            f"{risk_messages.get(risk, risk_messages['INSUFFICIENT_DATA'])}\n\n"
            f"{dev_text}{(' ' + fi_text) if fi_text else ''}\n\n"
            f"{'⚠ Red flags detected: ' + ', '.join(red_flags) + '. Please share this with your doctor.' if red_flags else 'No red flags detected in this period.'}\n\n"
            f"Note: This summary is generated by an AI assistant to help you understand your data. It does not replace medical advice from your care team."
        )

    return {
        "patient_id": patient_id,
        "disease_name": disease_name,
        "generated_at": now.isoformat(),
        "period_days": window_days,
        "risk_category": risk,
        "risk_probabilities": risk_probs,
        "top_deviations": top_deviations,
        "functional_impact": {
            "composite_pct": round(fis_composite * 100),
            "mobility_pct": mobility_score,
            "sleep_pct": sleep_score,
            "cognitive_pct": cognitive_score,
        },
        "red_flags": red_flags,
        "forecast_3d": forecast,
        "forecast_trend": forecast_trend,
        "patient_summary": ai_summary,
        "is_ai_generated": is_ai,
        "recommended_tests": tests,
        "disclaimer": "This report is a structured monitoring aid generated by RareSignal AI. It does NOT constitute medical advice, diagnosis, or prognosis. All clinical decisions remain with qualified healthcare providers.",
    }

