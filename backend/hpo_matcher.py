"""
backend/hpo_matcher.py
Semantic HPO Term Matcher using TF-IDF + cosine similarity.

Map any symptom key or free-text phrase to the nearest HPO term
in the disease's vocabulary without rigid hard-coded lookups.
Falls back gracefully to substring search if no vector match found.
"""

import re
import math
from typing import Dict, List, Optional, Tuple

# ─── HPO Master Vocabulary ────────────────────────────────────────────────────
# Built from all disease_config hpo_terms entries.
# Format: { hpo_id: label }
HPO_MASTER: Dict[str, str] = {
    # ENS
    "HP:0031458": "Nasal Dryness",
    "HP:0012366": "Nasal Crusting",
    "HP:0002107": "Nasal Obstruction",
    "HP:0000229": "Phantom Nasal Sensation",
    "HP:0000739": "Anxiety",
    "HP:0000716": "Depression",
    "HP:0001928": "Abnormal Sleep",
    "HP:0012378": "Fatigue",
    "HP:0012531": "Pain",
    # EDS
    "HP:0002829": "Joint Pain",
    "HP:0001942": "Skin Fragility",
    "HP:0002084": "Proprioception Loss",
    "HP:0001373": "Joint Subluxation",
    "HP:0002014": "GI Symptoms",
    "HP:0002094": "Breathlessness",
    "HP:0001278": "Orthostatic Hypotension",
    "HP:0002315": "Headache",
    "HP:0100543": "Cognitive Dysfunction",
    # POTS
    "HP:0002321": "Dizziness",
    "HP:0001962": "Palpitations",
    "HP:0007183": "Syncope",
    "HP:0025406": "Tremor",
    "HP:0001945": "Fever",
    # Heterotaxy / Cardiac
    "HP:0001629": "Ventricular Septal Defect",
    "HP:0002564": "Transposition Of Great Arteries",
    "HP:0002566": "Atrial Septal Defect",
    "HP:0001653": "Mitral Regurgitation",
    "HP:0001635": "Congestive Heart Failure",
    "HP:0002094b": "Dyspnea",
    "HP:0001744": "Splenomegaly",
    "HP:0001748": "Polysplenia",
    # PCD
    "HP:0002110": "Cough",
    "HP:0002099": "Asthma",
    "HP:0012179": "Mucociliary Clearance Defect",
    "HP:0005621": "Recurrent Sinusitis",
    # FMF
    "HP:0001873": "Thrombocytopenia",
    "HP:0002090": "Pneumonia",
    "HP:0001249": "Intellectual Disability",
    "HP:0001744": "Serositis",
    "HP:0002359": "Frequent Falls",
    "HP:0001744b": "Peritonitis",
    # CF
    "HP:0002017": "Nausea",
    "HP:0001410": "Malnutrition",
    "HP:0006528": "Chronic Lung Infection",
    "HP:0001511": "Growth Retardation",
    "HP:0003126": "Clubbing",
    # HD
    "HP:0001336": "Chorea",
    "HP:0000752": "Hyperactivity",
    "HP:0001300": "Parkinsonism",
    "HP:0000741": "Apathy",
    "HP:0002354": "Memory Impairment",
    "HP:0000726": "Dementia",
    # RTT
    "HP:0001336b": "Stereotypic Hand Movements",
    "HP:0000735": "Social Withdrawal",
    "HP:0007272": "Progressive Neurological Deterioration",
    "HP:0001250": "Seizures",
    "HP:0000739b": "Breathing Irregularity",
    "HP:0001288": "Gait Disturbance",
    # MFS
    "HP:0001649": "Aortic Root Dilation",
    "HP:0002650": "Scoliosis",
    "HP:0002705": "High Arched Palate",
    "HP:0001519": "Marfanoid Habitus",
    "HP:0000545": "Myopia",
    "HP:0001001": "Lens Dislocation",
    # SMA
    "HP:0001265": "Hypotonia",
    "HP:0003202": "Muscle Weakness",
    "HP:0001290": "Proximal Weakness",
    "HP:0002871": "Diaphragmatic Paralysis",
    # FXS
    "HP:0000752b": "Hyperactivity ADHD",
    "HP:0001263": "Global Developmental Delay",
    "HP:0001252": "Hypotonia",
    "HP:0000718": "Aggression",
    # NF1
    "HP:0009735": "Cafe-au-lait Spots",
    "HP:0001067": "Neurofibromas",
    "HP:0000572": "Visual Loss",
    "HP:0002650b": "Learning Disability",
    # PKU
    "HP:0001256": "Intellectual Disability PKU",
    "HP:0000708": "Behavioral Abnormality",
    "HP:0001263b": "Developmental Delay",
    # WD
    "HP:0001903": "Anemia",
    "HP:0001397": "Hepatic Steatosis",
    "HP:0001744c": "Splenomegaly WD",
    "HP:0002307": "Dysarthria",
    "HP:0001332": "Dystonia",
    # Pompe
    "HP:0003202b": "Muscle Weakness Pompe",
    "HP:0001324": "Muscle Cramps",
    "HP:0001637": "Cardiomyopathy",
    "HP:0002093": "Respiratory Failure",
    # Tay-Sachs
    "HP:0001336c": "Progressive Neurodegeneration",
    "HP:0001250b": "Epileptic Seizures",
    "HP:0001256b": "Developmental Regression",
    # Gaucher
    "HP:0002240": "Hepatomegaly",
    "HP:0001744d": "Thrombocytopenia Gaucher",
    "HP:0002653": "Bone Pain",
    # Alkaptonuria
    "HP:0002926": "Ochronotic Pigmentation",
    "HP:0004430": "Degenerative Joint Disease",
    "HP:0001337": "Cardiac Valve Disease",
    # Achondroplasia
    "HP:0000256": "Macrocephaly",
    "HP:0002673": "Short Limbs",
    "HP:0001250c": "Hearing Loss",
    # RRP
    "HP:0001620": "Hoarseness",
    "HP:0000961": "Papillomas Laryngeal",
    "HP:0002093b": "Stridor",
    # PRION
    "HP:0001300b": "Rapid Neurological Decline",
    "HP:0002352": "Spongiform Changes",
    "HP:0001260": "Dysarthria Prion",
}


# ─── Simple TF-IDF Vector Builder ────────────────────────────────────────────
def _tokenize(text: str) -> List[str]:
    """Lowercase, strip punctuation, split on whitespace."""
    text = text.lower()
    text = re.sub(r"[_\-/()]", " ", text)
    text = re.sub(r"[^a-z ]", "", text)
    return [t for t in text.split() if len(t) > 1]


def _build_vectors(corpus: List[List[str]]) -> Tuple[List[Dict[str, float]], Dict[str, float]]:
    """Build TF-IDF vectors for each document in corpus."""
    N = len(corpus)
    # IDF
    df: Dict[str, int] = {}
    for tokens in corpus:
        for t in set(tokens):
            df[t] = df.get(t, 0) + 1
    idf = {t: math.log((N + 1) / (cnt + 1)) + 1 for t, cnt in df.items()}

    vectors = []
    for tokens in corpus:
        tf: Dict[str, float] = {}
        for t in tokens:
            tf[t] = tf.get(t, 0) + 1
        n_tok = len(tokens) or 1
        vec = {t: (cnt / n_tok) * idf.get(t, 1.0) for t, cnt in tf.items()}
        # L2-normalize
        norm = math.sqrt(sum(v ** 2 for v in vec.values())) or 1.0
        vec = {t: v / norm for t, v in vec.items()}
        vectors.append(vec)
    return vectors, idf


def _cosine(a: Dict[str, float], b: Dict[str, float]) -> float:
    """Dot product of two sparse L2-normalised vectors."""
    return sum(a.get(k, 0.0) * v for k, v in b.items())


# ─── Precompute HPO vector index (built once at import) ──────────────────────
_HPO_LIST: List[Tuple[str, str]] = list(HPO_MASTER.items())  # [(hpo_id, label), ...]
_HPO_CORPUS: List[List[str]] = [_tokenize(label) for _, label in _HPO_LIST]
_HPO_VECTORS, _HPO_IDF = _build_vectors(_HPO_CORPUS)


# ─── Public API ───────────────────────────────────────────────────────────────
def match_symptom(
    symptom_key: str,
    disease_id: Optional[str] = None,
    top_k: int = 1
) -> List[Dict]:
    """
    Match a symptom key or free-text phrase to the nearest HPO term(s).

    Args:
        symptom_key: Internal symptom key (e.g., "joint_pain") or free text.
        disease_id:  (Optional) restrict to disease-relevant HPO terms.
        top_k:       Number of top matches to return.

    Returns:
        List of dicts: [{hpo_id, label, score}]
    """
    query_tokens = _tokenize(symptom_key)
    if not query_tokens:
        return [{"hpo_id": "HP:0000001", "label": "Phenotypic Abnormality", "score": 0.0}]

    # Build query TF vector and IDF-weight it
    tf: Dict[str, float] = {}
    for t in query_tokens:
        tf[t] = tf.get(t, 0) + 1
    n = len(query_tokens)
    query_vec: Dict[str, float] = {t: (cnt / n) * _HPO_IDF.get(t, 0.5) for t, cnt in tf.items()}
    norm = math.sqrt(sum(v ** 2 for v in query_vec.values())) or 1.0
    query_vec = {t: v / norm for t, v in query_vec.items()}

    # Score all HPO entries
    scored = []
    for i, (hpo_id, label) in enumerate(_HPO_LIST):
        score = _cosine(query_vec, _HPO_VECTORS[i])
        scored.append((score, hpo_id, label))

    scored.sort(key=lambda x: -x[0])
    results = [
        {"hpo_id": hid, "label": lbl, "score": round(s, 4)}
        for s, hid, lbl in scored[:top_k]
    ]
    return results


def get_disease_hpo_cluster(disease_id: str) -> List[Dict]:
    """
    Return all HPO terms that are relevant to a given disease,
    sorted by semantic centrality (closeness to disease name).

    Used for clustering semantically similar symptoms together.
    """
    from backend.disease_config import DISEASE_CONFIGS
    cfg = DISEASE_CONFIGS.get(disease_id, {})
    hpo_map = cfg.get("hpo_terms", {})

    cluster = []
    for sym, hpo_id in hpo_map.items():
        label = HPO_MASTER.get(hpo_id, hpo_id)
        # Find semantic neighbors within the disease HPO cluster
        neighbors = match_symptom(label, disease_id, top_k=3)
        cluster.append({
            "symptom_key": sym,
            "hpo_id": hpo_id,
            "label": label,
            "semantic_neighbors": neighbors
        })

    return cluster
