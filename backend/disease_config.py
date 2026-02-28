# disease_config.py — Disease-specific signal configurations for RareSignal AI
# Each disease defines: symptom vocabulary, FIS domain weights, red flags, trigger vocabulary

DISEASE_CONFIGS = {
    "ENS": {
        "name": "Empty Nose Syndrome",
        "symptoms": [
            "nasal_dryness", "crusting", "paradoxical_obstruction",
            "phantom_sensation", "anxiety", "depression",
            "sleep_quality", "fatigue", "pain"
        ],
        "symptom_labels": {
            "nasal_dryness": "Nasal Dryness",
            "crusting": "Crusting/Debris",
            "paradoxical_obstruction": "Paradoxical Obstruction",
            "phantom_sensation": "Phantom Sensations",
            "anxiety": "Anxiety",
            "depression": "Depression",
            "sleep_quality": "Sleep Quality (inverse)",
            "fatigue": "Fatigue",
            "pain": "Pain"
        },
        "fis_domain_weights": {
            "mobility": {"fatigue": 0.5, "pain": 0.5},
            "cognitive": {"anxiety": 0.4, "depression": 0.4, "fatigue": 0.2},
            "sleep": {"sleep_quality": 1.0},
            "work": {"fatigue": 0.4, "anxiety": 0.3, "depression": 0.3},
            "social": {"anxiety": 0.5, "depression": 0.5}
        },
        "domain_weights": {"mobility": 0.15, "cognitive": 0.25, "sleep": 0.25, "work": 0.2, "social": 0.15},
        "triggers": ["dry_environment", "allergens", "stress", "sleep_deprivation",
                     "nasal_spray_use", "weather_change", "exercise"],
        "red_flags": {
            "mental_health_crisis": {"symptoms": ["depression", "anxiety"], "z_threshold": 2.5},
        },
        "baseline_window_days": 21,
        "min_observations": 7
    },

    "EDS": {
        "name": "Ehlers-Danlos Syndrome",
        "symptoms": [
            "joint_pain", "fatigue", "skin_fragility", "proprioception_loss",
            "subluxation_frequency", "gi_symptoms", "pots_symptoms",
            "sleep_quality", "brain_fog", "anxiety"
        ],
        "symptom_labels": {
            "joint_pain": "Joint Pain",
            "fatigue": "Fatigue",
            "skin_fragility": "Skin Fragility",
            "proprioception_loss": "Proprioception Loss",
            "subluxation_frequency": "Subluxation Events",
            "gi_symptoms": "GI Symptoms",
            "pots_symptoms": "POTS Symptoms",
            "sleep_quality": "Sleep Quality (inverse)",
            "brain_fog": "Brain Fog",
            "anxiety": "Anxiety"
        },
        "fis_domain_weights": {
            "mobility": {"joint_pain": 0.5, "subluxation_frequency": 0.3, "proprioception_loss": 0.2},
            "cognitive": {"brain_fog": 0.7, "anxiety": 0.3},
            "sleep": {"sleep_quality": 0.7, "pain": 0.3},
            "work": {"fatigue": 0.4, "joint_pain": 0.3, "brain_fog": 0.3},
            "social": {"anxiety": 0.5, "fatigue": 0.3, "joint_pain": 0.2}
        },
        "domain_weights": {"mobility": 0.30, "cognitive": 0.20, "sleep": 0.20, "work": 0.15, "social": 0.15},
        "triggers": ["overexertion", "weather_change", "stress", "sleep_deprivation",
                     "hormonal_changes", "dehydration", "infection"],
        "red_flags": {
            "joint_dislocation": {"symptoms": ["subluxation_frequency"], "any_occurrence_threshold": 3},
        },
        "baseline_window_days": 30,
        "min_observations": 10
    },

    "POTS": {
        "name": "Postural Orthostatic Tachycardia Syndrome",
        "symptoms": [
            "dizziness", "heart_rate_elevation", "fatigue", "brain_fog",
            "syncope_nearness", "nausea", "exercise_intolerance",
            "sleep_quality", "anxiety", "gi_symptoms"
        ],
        "symptom_labels": {
            "dizziness": "Dizziness/Lightheadedness",
            "heart_rate_elevation": "HR Elevation on Standing",
            "fatigue": "Fatigue",
            "brain_fog": "Brain Fog",
            "syncope_nearness": "Near-Syncope Events",
            "nausea": "Nausea",
            "exercise_intolerance": "Exercise Intolerance",
            "sleep_quality": "Sleep Quality (inverse)",
            "anxiety": "Anxiety",
            "gi_symptoms": "GI Symptoms"
        },
        "fis_domain_weights": {
            "mobility": {"dizziness": 0.4, "exercise_intolerance": 0.4, "syncope_nearness": 0.2},
            "cognitive": {"brain_fog": 0.6, "anxiety": 0.4},
            "sleep": {"sleep_quality": 0.8, "fatigue": 0.2},
            "work": {"fatigue": 0.4, "brain_fog": 0.3, "dizziness": 0.3},
            "social": {"anxiety": 0.4, "fatigue": 0.3, "exercise_intolerance": 0.3}
        },
        "domain_weights": {"mobility": 0.25, "cognitive": 0.20, "sleep": 0.20, "work": 0.20, "social": 0.15},
        "triggers": ["dehydration", "heat_exposure", "prolonged_standing", "stress",
                     "sleep_deprivation", "alcohol", "large_meals", "exercise"],
        "red_flags": {
            "syncope": {"symptoms": ["syncope_nearness"], "any_occurrence_threshold": 1},
            "hr_crisis": {"symptoms": ["heart_rate_elevation"], "z_threshold": 3.0},
        },
        "baseline_window_days": 21,
        "min_observations": 7
    },

    "Heterotaxy": {
        "name": "Heterotaxy Syndrome",
        "symptoms": [
            "breathlessness", "cyanosis", "fatigue", "exercise_intolerance",
            "palpitations", "oxygen_saturation_drop", "edema", "feeding_difficulty",
            "sleep_quality", "anxiety"
        ],
        "symptom_labels": {
            "breathlessness": "Breathlessness",
            "cyanosis": "Cyanosis",
            "fatigue": "Fatigue",
            "exercise_intolerance": "Exercise Intolerance",
            "palpitations": "Palpitations",
            "oxygen_saturation_drop": "O2 Sat Drop (perceived)",
            "edema": "Edema",
            "feeding_difficulty": "Feeding/Eating Difficulty",
            "sleep_quality": "Sleep Quality (inverse)",
            "anxiety": "Anxiety"
        },
        "fis_domain_weights": {
            "mobility": {"breathlessness": 0.4, "exercise_intolerance": 0.4, "edema": 0.2},
            "cognitive": {"anxiety": 0.6, "fatigue": 0.4},
            "sleep": {"sleep_quality": 0.7, "breathlessness": 0.3},
            "work": {"fatigue": 0.4, "breathlessness": 0.3, "exercise_intolerance": 0.3},
            "social": {"anxiety": 0.4, "fatigue": 0.3, "exercise_intolerance": 0.3}
        },
        "domain_weights": {"mobility": 0.30, "cognitive": 0.15, "sleep": 0.20, "work": 0.15, "social": 0.20},
        "triggers": ["exertion", "illness", "heat_exposure", "stress",
                     "dehydration", "sleep_deprivation", "altitude"],
        "red_flags": {
            "cyanosis_event": {"symptoms": ["cyanosis"], "z_threshold": 2.0},
            "severe_breathlessness": {"symptoms": ["breathlessness"], "z_threshold": 2.5},
        },
        "baseline_window_days": 21,
        "min_observations": 7
    },

    "PCD": {
        "name": "Primary Ciliary Dyskinesia",
        "symptoms": [
            "cough_severity", "nasal_congestion", "breathlessness", "sputum_production",
            "chest_tightness", "fatigue", "infection_frequency",
            "sleep_quality", "exercise_intolerance", "hearing_issues"
        ],
        "symptom_labels": {
            "cough_severity": "Cough Severity",
            "nasal_congestion": "Nasal Congestion",
            "breathlessness": "Breathlessness",
            "sputum_production": "Sputum Production",
            "chest_tightness": "Chest Tightness",
            "fatigue": "Fatigue",
            "infection_frequency": "Infection Frequency",
            "sleep_quality": "Sleep Quality (inverse)",
            "exercise_intolerance": "Exercise Intolerance",
            "hearing_issues": "Hearing Issues"
        },
        "fis_domain_weights": {
            "mobility": {"breathlessness": 0.5, "exercise_intolerance": 0.3, "fatigue": 0.2},
            "cognitive": {"fatigue": 0.5, "hearing_issues": 0.5},
            "sleep": {"sleep_quality": 0.6, "cough_severity": 0.4},
            "work": {"fatigue": 0.4, "breathlessness": 0.3, "cough_severity": 0.3},
            "social": {"cough_severity": 0.4, "fatigue": 0.3, "breathlessness": 0.3}
        },
        "domain_weights": {"mobility": 0.25, "cognitive": 0.15, "sleep": 0.25, "work": 0.20, "social": 0.15},
        "triggers": ["cold_weather", "allergens", "infection", "exertion",
                     "smoke_exposure", "stress", "sleep_deprivation"],
        "red_flags": {
            "respiratory_crisis": {"symptoms": ["breathlessness", "cough_severity"], "z_threshold": 2.5},
            "fever_combination": {"symptoms": ["infection_frequency"], "z_threshold": 2.0},
        },
        "baseline_window_days": 21,
        "min_observations": 7
    },

    "FMF": {
        "name": "Familial Mediterranean Fever",
        "symptoms": [
            "fever", "abdominal_pain", "chest_pain", "joint_pain",
            "fatigue", "muscle_aches", "skin_rash",
            "sleep_quality", "anxiety", "brain_fog"
        ],
        "symptom_labels": {
            "fever": "Fever",
            "abdominal_pain": "Abdominal Pain",
            "chest_pain": "Chest Pain",
            "joint_pain": "Joint Pain",
            "fatigue": "Fatigue",
            "muscle_aches": "Muscle Aches",
            "skin_rash": "Erysipelas-like Erythema",
            "sleep_quality": "Sleep Quality (inverse)",
            "anxiety": "Anxiety",
            "brain_fog": "Brain Fog"
        },
        "fis_domain_weights": {
            "mobility": {"joint_pain": 0.4, "muscle_aches": 0.3, "fatigue": 0.3},
            "cognitive": {"brain_fog": 0.6, "anxiety": 0.4},
            "sleep": {"sleep_quality": 0.7, "fever": 0.3},
            "work": {"fatigue": 0.3, "fever": 0.3, "abdominal_pain": 0.2, "brain_fog": 0.2},
            "social": {"fatigue": 0.4, "anxiety": 0.3, "abdominal_pain": 0.3}
        },
        "domain_weights": {"mobility": 0.20, "cognitive": 0.15, "sleep": 0.20, "work": 0.25, "social": 0.20},
        "triggers": ["stress", "exertion", "infection", "menstruation", "cold_exposure", "sleep_deprivation"],
        "red_flags": {
            "high_fever_crisis": {"symptoms": ["fever"], "z_threshold": 2.5},
            "severe_abdominal_attack": {"symptoms": ["abdominal_pain", "chest_pain"], "z_threshold": 2.5},
        },
        "baseline_window_days": 21,
        "min_observations": 7
    }
}

