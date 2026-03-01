"""
backend/nlp_extractor.py
Extracts symptom severity values from free-text clinical notes (PDF or typed).

Pipeline (in order of preference):
  1. Numeric pattern  — "dizziness 7/10", "fatigue: 8", "pain score 6 out of 10"
  2. Severity adjective — "severe dizziness", "mild fatigue", "no joint pain"
  3. Gemini API fallback — if GEMINI_API_KEY is set and local extraction yields < 3 symptoms
"""
import re
import os
import json
from typing import Dict, Tuple, Optional

# ─── Severity word → 0-10 map ────────────────────────────────────────────────
SEVERITY_WORDS: Dict[str, float] = {
    "absent":       0.0, "none":     0.0, "no":       0.0,
    "negligible":   1.0, "minimal":  1.5,
    "very mild":    2.0,
    "mild":         3.0, "slight":   2.5, "minor":    2.5,
    "low":          3.5,
    "moderate":     5.0, "medium":   5.0, "middle":   5.0,
    "noticeable":   5.5, "notable":  5.5,
    "significant":  6.5, "considerable": 6.5,
    "high":         7.0,
    "severe":       8.0, "bad":      7.5, "strong":   7.5,
    "very severe":  9.0, "intense":  8.5,
    "extreme":      10.0, "worst":   10.0, "unbearable": 10.0,
}

# Build a flattened alias -> value dict (longest first for greedy match)
_SEVERITY_PATTERN = "|".join(
    re.escape(k) for k in sorted(SEVERITY_WORDS, key=len, reverse=True)
)

# Synonym aliases (symptom keyword -> canonical name)
SYMPTOM_ALIASES: Dict[str, str] = {
    "dizziness": "dizziness", "dizzy": "dizziness", "vertigo": "dizziness",
    "heart rate": "heart_rate_elevation", "tachycardia": "heart_rate_elevation",
    "palpitations": "heart_rate_elevation", "heart palpitation": "heart_rate_elevation",
    "fatigue": "fatigue", "tiredness": "fatigue", "exhaustion": "fatigue",
    "brain fog": "brain_fog", "cognitive": "brain_fog", "confusion": "brain_fog",
    "syncope": "syncope_nearness", "fainting": "syncope_nearness", "near faint": "syncope_nearness",
    "nausea": "nausea", "nauseous": "nausea", "vomiting": "nausea",
    "exercise intolerance": "exercise_intolerance", "exertion": "exercise_intolerance",
    "sleep": "sleep_quality", "insomnia": "sleep_quality",
    "anxiety": "anxiety", "stress": "stress_symptom_severity",
    "joint pain": "joint_pain", "joint ache": "joint_pain", "arthralgia": "joint_pain",
    "skin": "skin_fragility", "skin fragility": "skin_fragility",
    "proprioception": "proprioception_loss", "balance": "proprioception_loss",
    "subluxation": "subluxation_frequency", "dislocation": "subluxation_frequency",
    "gi": "gi_symptoms", "gastrointestinal": "gi_symptoms", "stomach": "gi_symptoms",
    "pots": "pots_symptoms",
    "cough": "cough_severity", "coughing": "cough_severity",
    "nasal": "nasal_congestion", "congestion": "nasal_congestion", "runny nose": "nasal_congestion",
    "breathlessness": "breathlessness", "shortness of breath": "breathlessness", "dyspnea": "breathlessness",
    "sputum": "sputum_production", "phlegm": "sputum_production", "mucus": "sputum_production",
    "chest tightness": "chest_tightness", "chest pain": "chest_tightness",
    "infection": "infection_frequency", "fever": "infection_frequency",
    "hearing": "hearing_issues", "hearing loss": "hearing_issues",
}

# Pre-sort aliases by length descending for greedy matching
_SORTED_ALIASES = sorted(SYMPTOM_ALIASES, key=len, reverse=True)


def _match_severity_word(text: str) -> Optional[float]:
    """Find the first severity adjective in a short snippet."""
    m = re.search(rf'\b({_SEVERITY_PATTERN})\b', text, re.IGNORECASE)
    if m:
        return SEVERITY_WORDS[m.group(1).lower()]
    return None


def _numeric_score(text: str) -> Optional[float]:
    """Extract X/10 or score: X patterns."""
    # "7/10", "7 / 10", "7 out of 10"
    m = re.search(r'\b(\d+(?:\.\d+)?)\s*(?:/|out\s+of)\s*10\b', text, re.IGNORECASE)
    if m:
        return min(float(m.group(1)), 10.0)
    # "score: 7", "rating 7"
    m = re.search(r'(?:score|rating|level|value|severity)[:\s]+(\d+(?:\.\d+)?)', text, re.IGNORECASE)
    if m:
        v = float(m.group(1))
        return v if v <= 10 else v / 10  # handle 0-100 scale
    return None


def extract_symptoms_from_text(
    text: str,
    disease_symptoms: list,
    use_gemini: bool = True,
) -> Dict[str, Tuple[float, int]]:
    """
    Returns { canonical_symptom_name: (value_0_to_10, confidence_pct) }

    confidence_pct:
      90 = numeric score found
      65 = severity adjective found in close proximity
      40 = symptom keyword found, value estimated from context
    """
    text_lower = text.lower()
    results: Dict[str, Tuple[float, int]] = {}

    for alias in _SORTED_ALIASES:
        canonical = SYMPTOM_ALIASES[alias]
        if canonical not in disease_symptoms:
            continue
        if canonical in results:
            continue  # already captured via another alias

        # Find alias in text
        pattern = re.compile(rf'\b{re.escape(alias)}\b', re.IGNORECASE)
        for m in pattern.finditer(text_lower):
            start = m.start()
            # Extract surrounding window (~60 chars each side)
            window = text_lower[max(0, start - 60): start + 80]

            # 1) Try numeric
            num = _numeric_score(window)
            if num is not None:
                results[canonical] = (round(num, 1), 90)
                break

            # 2) Try adjective
            adj = _match_severity_word(window)
            if adj is not None:
                results[canonical] = (round(adj, 1), 65)
                break

            # 3) Presence-only fallback (moderate estimate = 5)
            results[canonical] = (5.0, 40)
            break

    # Gemini fallback for low-confidence extractions
    if use_gemini and len(results) < 3:
        gemini_results = _gemini_extract(text, disease_symptoms)
        for sym, (val, conf) in gemini_results.items():
            if sym not in results or results[sym][1] < conf:
                results[sym] = (val, conf)

    return results


def _gemini_extract(text: str, disease_symptoms: list) -> Dict[str, Tuple[float, int]]:
    """Use Gemini API to extract symptom severities from clinical text."""
    try:
        import google.generativeai as genai
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return {}
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")

        symptoms_list = ", ".join(disease_symptoms)
        prompt = (
            f"You are a clinical NLP system. Extract symptom severity scores (0-10 scale) "
            f"from the following clinical note.\n\n"
            f"Only extract values for these symptoms: {symptoms_list}\n\n"
            f"Return ONLY valid JSON like:\n"
            f'{{"{disease_symptoms[0]}": 6.5, "{disease_symptoms[1]}": 3.0}}\n\n'
            f"If a symptom is not mentioned, omit it. Do NOT include explanations.\n\n"
            f"Clinical note:\n{text[:3000]}"
        )
        response = model.generate_content(prompt)
        raw = response.text.strip()
        # Strip markdown code fences if present
        raw = re.sub(r'^```[a-z]*\n?', '', raw).rstrip('`').strip()
        parsed = json.loads(raw)
        return {k: (float(v), 80) for k, v in parsed.items() if k in disease_symptoms}
    except Exception:
        return {}


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract all text from a PDF file given as bytes. Uses PyMuPDF (fitz)."""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages = []
        for page in doc:
            pages.append(page.get_text())
        return "\n\n".join(pages)
    except ImportError:
        raise RuntimeError(
            "PyMuPDF not installed. Run: pip install pymupdf"
        )
    except Exception as e:
        raise RuntimeError(f"Failed to read PDF: {e}")
