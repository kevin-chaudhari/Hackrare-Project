#!/usr/bin/env python3
"""
seed_demo.py — Seed the RareSignal AI database with demo data for 3 patients.
Simulates 30 days of symptom logging including flare events.

Usage:
    python seed_demo.py
"""
import sys
import os
import requests
import random
import json
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

BASE = "http://localhost:8000"

DEMO_PATIENTS = [
    {"id": "demo-pots-01", "disease": "POTS",
     "flare_days": [8, 22], "noise": 1.0},
    {"id": "demo-eds-01", "disease": "EDS",
     "flare_days": [5, 18, 28], "noise": 0.9},
    {"id": "demo-pcd-01", "disease": "PCD",
     "flare_days": [12, 25], "noise": 1.1},
]

DISEASE_CONFIGS = {
    "POTS": {
        "symptoms": ["dizziness", "heart_rate_elevation", "fatigue", "brain_fog",
                     "syncope_nearness", "nausea", "exercise_intolerance",
                     "sleep_quality", "anxiety", "gi_symptoms"],
        "triggers": ["dehydration", "heat_exposure", "prolonged_standing", "stress",
                     "sleep_deprivation", "alcohol", "large_meals", "exercise"],
        "baselines": {"dizziness": 4.0, "heart_rate_elevation": 3.5, "fatigue": 5.0,
                      "brain_fog": 4.5, "syncope_nearness": 2.0, "nausea": 2.5,
                      "exercise_intolerance": 5.5, "sleep_quality": 4.0,
                      "anxiety": 3.5, "gi_symptoms": 2.0}
    },
    "EDS": {
        "symptoms": ["joint_pain", "fatigue", "skin_fragility", "proprioception_loss",
                     "subluxation_frequency", "gi_symptoms", "pots_symptoms",
                     "sleep_quality", "brain_fog", "anxiety"],
        "triggers": ["overexertion", "weather_change", "stress", "sleep_deprivation",
                     "hormonal_changes", "dehydration", "infection"],
        "baselines": {"joint_pain": 4.5, "fatigue": 5.0, "skin_fragility": 3.0,
                      "proprioception_loss": 3.5, "subluxation_frequency": 2.0,
                      "gi_symptoms": 2.5, "pots_symptoms": 2.0, "sleep_quality": 4.5,
                      "brain_fog": 4.0, "anxiety": 3.0}
    },
    "PCD": {
        "symptoms": ["cough_severity", "nasal_congestion", "breathlessness", "sputum_production",
                     "chest_tightness", "fatigue", "infection_frequency",
                     "sleep_quality", "exercise_intolerance", "hearing_issues"],
        "triggers": ["cold_weather", "allergens", "infection", "exertion",
                     "smoke_exposure", "stress", "sleep_deprivation"],
        "baselines": {"cough_severity": 4.0, "nasal_congestion": 5.0, "breathlessness": 3.5,
                      "sputum_production": 4.5, "chest_tightness": 3.0, "fatigue": 4.5,
                      "infection_frequency": 2.0, "sleep_quality": 4.0,
                      "exercise_intolerance": 3.5, "hearing_issues": 3.0}
    }
}


def create_patient(patient_id, disease):
    try:
        r = requests.post(f"{BASE}/patients", json={"id": patient_id, "disease": disease})
        if r.status_code in (200, 201):
            print(f"  ✓ Created patient: {patient_id} ({disease})")
        elif r.status_code == 409:
            print(f"  ⟳ Patient already exists: {patient_id}")
        else:
            print(f"  ✗ Failed: {r.text}")
    except Exception as e:
        print(f"  ✗ Error: {e}")


def seed_entries(patient):
    pid = patient["id"]
    disease = patient["disease"]
    flare_days = patient["flare_days"]
    noise = patient["noise"]
    cfg = DISEASE_CONFIGS[disease]
    symptoms = cfg["symptoms"]
    triggers = cfg["triggers"]
    baselines = cfg["baselines"]

    n_days = 30
    now = datetime.utcnow()
    start = now - timedelta(days=n_days)

    entries_added = 0
    for day in range(n_days):
        # Skip ~15% of days (missingness)
        if random.random() < 0.15:
            continue

        ts = start + timedelta(days=day)

        # Flare proximity
        prox = min([abs(day - fd) for fd in flare_days])
        flare_intensity = max(0.0, 2.0 - prox * 0.35)

        symptom_vals = {}
        for sym in symptoms:
            base = baselines.get(sym, 5.0)
            val = base + flare_intensity * random.uniform(0.8, 2.0) + random.gauss(0, noise)
            symptom_vals[sym] = round(max(0.0, min(10.0, val)), 1)

        active_triggers = []
        for t in triggers:
            p = 0.45 if flare_intensity > 0.8 else 0.08
            if random.random() < p:
                active_triggers.append(t)

        try:
            r = requests.post(f"{BASE}/entries", json={
                "patient_id": pid,
                "timestamp": ts.isoformat(),
                "symptoms": symptom_vals,
                "triggers": active_triggers,
                "notes": f"Day {day} — flare intensity: {flare_intensity:.1f}" if flare_intensity > 0.5 else None
            })
            if r.status_code in (200, 201):
                entries_added += 1
            else:
                print(f"    Entry error: {r.status_code} {r.text[:80]}")
        except Exception as e:
            print(f"    Entry error: {e}")

    print(f"  ✓ Added {entries_added} entries for {pid}")

    # Compute signals
    try:
        r = requests.post(f"{BASE}/compute-signals", json={"patient_id": pid, "window_days": 7})
        if r.status_code == 200:
            data = r.json()
            print(f"  ✓ Signals computed. Risk: {data['risk_category']} | Volatility: {data['volatility']['value']:.3f}")
        else:
            print(f"  ✗ Signal error: {r.text[:120]}")
    except Exception as e:
        print(f"  ✗ Signal error: {e}")


def main():
    print("=" * 60)
    print("RareSignal AI — Demo Data Seeder")
    print("=" * 60)

    # Check backend
    try:
        r = requests.get(f"{BASE}/health", timeout=3)
        print(f"✓ Backend online: {r.json()}\n")
    except Exception:
        print("✗ Backend not reachable. Start it with:")
        print("  uvicorn backend.main:app --reload")
        sys.exit(1)

    for p in DEMO_PATIENTS:
        print(f"\nSeeding {p['id']} ({p['disease']})...")
        create_patient(p["id"], p["disease"])
        seed_entries(p)

    print("\n" + "=" * 60)
    print("Demo data seeded! Open http://localhost:3000 to view.")
    print("=" * 60)


if __name__ == "__main__":
    main()
