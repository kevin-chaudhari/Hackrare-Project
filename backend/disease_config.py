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

# Appending new diseases dynamically
NEW_DISEASES = {
    "CF": {
        "name": "Cystic Fibrosis",
        "symptoms": [
            "cough_severity",
            "breathlessness",
            "fatigue",
            "sputum_production",
            "chest_tightness",
            "sleep_quality",
            "anxiety"
        ],
        "symptom_labels": {
            "cough_severity": "Cough Severity",
            "breathlessness": "Breathlessness",
            "fatigue": "Fatigue",
            "sputum_production": "Sputum Production",
            "chest_tightness": "Chest Tightness",
            "sleep_quality": "Sleep Quality (inverse)",
            "anxiety": "Anxiety"
        },
        "fis_domain_weights": {
            "mobility": {
                "breathlessness": 0.5,
                "fatigue": 0.5
            },
            "cognitive": {
                "anxiety": 1.0
            },
            "sleep": {
                "sleep_quality": 0.7,
                "cough_severity": 0.3
            },
            "work": {
                "fatigue": 0.4,
                "breathlessness": 0.3,
                "cough_severity": 0.3
            },
            "social": {
                "anxiety": 0.4,
                "cough_severity": 0.3,
                "fatigue": 0.3
            }
        },
        "domain_weights": {
            "mobility": 0.25,
            "cognitive": 0.15,
            "sleep": 0.2,
            "work": 0.25,
            "social": 0.15
        },
        "triggers": [
            "infection",
            "allergens",
            "cold_weather",
            "exertion",
            "stress"
        ],
        "red_flags": {
            "respiratory_exacerbation": {
                "symptoms": [
                    "breathlessness",
                    "sputum_production"
                ],
                "z_threshold": 2.5
            }
        },
        "baseline_window_days": 21,
        "min_observations": 7
    },
    "HD": {
        "name": "Huntington Disease",
        "symptoms": [
            "chorea",
            "cognitive_decline",
            "depression",
            "irritability",
            "sleep_quality",
            "fatigue",
            "balance_issues"
        ],
        "symptom_labels": {
            "chorea": "Chorea/Involuntary Movements",
            "cognitive_decline": "Cognitive Difficulties",
            "depression": "Depression",
            "irritability": "Irritability",
            "sleep_quality": "Sleep Quality (inverse)",
            "fatigue": "Fatigue",
            "balance_issues": "Balance Issues"
        },
        "fis_domain_weights": {
            "mobility": {
                "chorea": 0.6,
                "balance_issues": 0.4
            },
            "cognitive": {
                "cognitive_decline": 0.8,
                "depression": 0.2
            },
            "sleep": {
                "sleep_quality": 1.0
            },
            "work": {
                "cognitive_decline": 0.5,
                "chorea": 0.3,
                "fatigue": 0.2
            },
            "social": {
                "irritability": 0.4,
                "depression": 0.3,
                "chorea": 0.3
            }
        },
        "domain_weights": {
            "mobility": 0.3,
            "cognitive": 0.3,
            "sleep": 0.1,
            "work": 0.15,
            "social": 0.15
        },
        "triggers": [
            "stress",
            "sleep_deprivation",
            "illness",
            "medication_changes"
        ],
        "red_flags": {
            "severe_chorea_crisis": {
                "symptoms": [
                    "chorea",
                    "balance_issues"
                ],
                "z_threshold": 2.5
            }
        },
        "baseline_window_days": 30,
        "min_observations": 10
    },
    "RTT": {
        "name": "Rett Syndrome",
        "symptoms": [
            "motor_regression",
            "breathing_irregularities",
            "seizures",
            "sleep_disturbances",
            "irritability",
            "scoliosis_pain"
        ],
        "symptom_labels": {
            "motor_regression": "Motor Skill difficulties",
            "breathing_irregularities": "Breathing Irregularities",
            "seizures": "Seizure Activity",
            "sleep_disturbances": "Sleep Disturbances",
            "irritability": "Irritability",
            "scoliosis_pain": "Scoliosis Pain"
        },
        "fis_domain_weights": {
            "mobility": {
                "motor_regression": 0.7,
                "scoliosis_pain": 0.3
            },
            "cognitive": {
                "irritability": 1.0
            },
            "sleep": {
                "sleep_disturbances": 0.7,
                "seizures": 0.3
            },
            "work": {
                "motor_regression": 0.6,
                "seizures": 0.4
            },
            "social": {
                "irritability": 0.5,
                "seizures": 0.5
            }
        },
        "domain_weights": {
            "mobility": 0.35,
            "cognitive": 0.1,
            "sleep": 0.25,
            "work": 0.1,
            "social": 0.2
        },
        "triggers": [
            "stress",
            "illness",
            "fever",
            "sleep_deprivation"
        ],
        "red_flags": {
            "seizure_cluster": {
                "symptoms": [
                    "seizures"
                ],
                "any_occurrence_threshold": 1
            },
            "breathing_crisis": {
                "symptoms": [
                    "breathing_irregularities"
                ],
                "z_threshold": 2.5
            }
        },
        "baseline_window_days": 21,
        "min_observations": 7
    },
    "MFS": {
        "name": "Marfan Syndrome",
        "symptoms": [
            "chest_pain",
            "palpitations",
            "joint_pain",
            "fatigue",
            "vision_changes",
            "back_pain",
            "shortness_of_breath"
        ],
        "symptom_labels": {
            "chest_pain": "Chest Pain",
            "palpitations": "Palpitations",
            "joint_pain": "Joint Pain",
            "fatigue": "Fatigue",
            "vision_changes": "Vision Changes/Blurriness",
            "back_pain": "Back Pain",
            "shortness_of_breath": "Shortness of Breath"
        },
        "fis_domain_weights": {
            "mobility": {
                "joint_pain": 0.5,
                "back_pain": 0.5
            },
            "cognitive": {
                "fatigue": 1.0
            },
            "sleep": {
                "fatigue": 0.5,
                "back_pain": 0.5
            },
            "work": {
                "fatigue": 0.4,
                "vision_changes": 0.3,
                "joint_pain": 0.3
            },
            "social": {
                "fatigue": 0.5,
                "shortness_of_breath": 0.5
            }
        },
        "domain_weights": {
            "mobility": 0.3,
            "cognitive": 0.1,
            "sleep": 0.2,
            "work": 0.2,
            "social": 0.2
        },
        "triggers": [
            "exertion",
            "stress",
            "heavy_lifting",
            "contact_sports"
        ],
        "red_flags": {
            "aortic_dissection_warning": {
                "symptoms": [
                    "chest_pain",
                    "shortness_of_breath"
                ],
                "z_threshold": 2.5
            }
        },
        "baseline_window_days": 21,
        "min_observations": 7
    },
    "SMA": {
        "name": "Spinal Muscular Atrophy",
        "symptoms": [
            "muscle_weakness",
            "swallowing_difficulty",
            "respiratory_distress",
            "fatigue",
            "joint_contracture_pain",
            "sleep_quality"
        ],
        "symptom_labels": {
            "muscle_weakness": "Muscle Weakness",
            "swallowing_difficulty": "Swallowing Difficulty",
            "respiratory_distress": "Respiratory Distress",
            "fatigue": "Fatigue",
            "joint_contracture_pain": "Joint Contracture Pain",
            "sleep_quality": "Sleep Quality (inverse)"
        },
        "fis_domain_weights": {
            "mobility": {
                "muscle_weakness": 0.7,
                "joint_contracture_pain": 0.3
            },
            "cognitive": {
                "fatigue": 1.0
            },
            "sleep": {
                "sleep_quality": 0.6,
                "respiratory_distress": 0.4
            },
            "work": {
                "muscle_weakness": 0.5,
                "fatigue": 0.5
            },
            "social": {
                "swallowing_difficulty": 0.6,
                "fatigue": 0.4
            }
        },
        "domain_weights": {
            "mobility": 0.4,
            "cognitive": 0.1,
            "sleep": 0.2,
            "work": 0.15,
            "social": 0.15
        },
        "triggers": [
            "infection",
            "exertion",
            "fatigue",
            "cold"
        ],
        "red_flags": {
            "respiratory_failure_risk": {
                "symptoms": [
                    "respiratory_distress",
                    "swallowing_difficulty"
                ],
                "z_threshold": 2.5
            }
        },
        "baseline_window_days": 21,
        "min_observations": 7
    },
    "FXS": {
        "name": "Fragile X Syndrome",
        "symptoms": [
            "anxiety",
            "hyperactivity",
            "sensory_overload",
            "sleep_disturbances",
            "attention_issues",
            "aggression"
        ],
        "symptom_labels": {
            "anxiety": "Anxiety",
            "hyperactivity": "Hyperactivity",
            "sensory_overload": "Sensory Overload",
            "sleep_disturbances": "Sleep Disturbances",
            "attention_issues": "Attention Issues",
            "aggression": "Aggressive Outbursts"
        },
        "fis_domain_weights": {
            "mobility": {
                "hyperactivity": 1.0
            },
            "cognitive": {
                "attention_issues": 0.6,
                "sensory_overload": 0.4
            },
            "sleep": {
                "sleep_disturbances": 1.0
            },
            "work": {
                "attention_issues": 0.4,
                "anxiety": 0.3,
                "hyperactivity": 0.3
            },
            "social": {
                "aggression": 0.5,
                "anxiety": 0.3,
                "sensory_overload": 0.2
            }
        },
        "domain_weights": {
            "mobility": 0.1,
            "cognitive": 0.3,
            "sleep": 0.2,
            "work": 0.2,
            "social": 0.2
        },
        "triggers": [
            "routine_changes",
            "crowds",
            "loud_noises",
            "stress",
            "transition_periods"
        ],
        "red_flags": {
            "severe_behavioral_crisis": {
                "symptoms": [
                    "aggression",
                    "sensory_overload"
                ],
                "z_threshold": 2.5
            }
        },
        "baseline_window_days": 14,
        "min_observations": 5
    },
    "NF1": {
        "name": "Neurofibromatosis Type 1",
        "symptoms": [
            "nerve_pain",
            "headaches",
            "fatigue",
            "vision_changes",
            "learning_difficulties",
            "bone_pain",
            "anxiety"
        ],
        "symptom_labels": {
            "nerve_pain": "Nerve Pain",
            "headaches": "Headaches",
            "fatigue": "Fatigue",
            "vision_changes": "Vision Changes",
            "learning_difficulties": "Cognitive/Learning Difficulty",
            "bone_pain": "Bone Pain",
            "anxiety": "Anxiety"
        },
        "fis_domain_weights": {
            "mobility": {
                "bone_pain": 0.5,
                "nerve_pain": 0.5
            },
            "cognitive": {
                "learning_difficulties": 0.7,
                "anxiety": 0.3
            },
            "sleep": {
                "nerve_pain": 0.6,
                "headaches": 0.4
            },
            "work": {
                "fatigue": 0.4,
                "learning_difficulties": 0.3,
                "headaches": 0.3
            },
            "social": {
                "anxiety": 0.6,
                "fatigue": 0.4
            }
        },
        "domain_weights": {
            "mobility": 0.2,
            "cognitive": 0.25,
            "sleep": 0.2,
            "work": 0.2,
            "social": 0.15
        },
        "triggers": [
            "stress",
            "fatigue",
            "hormonal_changes",
            "illness"
        ],
        "red_flags": {
            "optic_glioma_warning": {
                "symptoms": [
                    "vision_changes",
                    "headaches"
                ],
                "z_threshold": 2.5
            }
        },
        "baseline_window_days": 21,
        "min_observations": 7
    },
    "PKU": {
        "name": "Phenylketonuria",
        "symptoms": [
            "brain_fog",
            "mood_swings",
            "tremors",
            "focus_issues",
            "fatigue",
            "headaches"
        ],
        "symptom_labels": {
            "brain_fog": "Brain Fog",
            "mood_swings": "Mood Swings/Irritability",
            "tremors": "Tremors",
            "focus_issues": "Focus/Attention Issues",
            "fatigue": "Fatigue",
            "headaches": "Headaches"
        },
        "fis_domain_weights": {
            "mobility": {
                "tremors": 1.0
            },
            "cognitive": {
                "brain_fog": 0.6,
                "focus_issues": 0.4
            },
            "sleep": {
                "fatigue": 0.5,
                "headaches": 0.5
            },
            "work": {
                "focus_issues": 0.5,
                "brain_fog": 0.3,
                "fatigue": 0.2
            },
            "social": {
                "mood_swings": 0.8,
                "fatigue": 0.2
            }
        },
        "domain_weights": {
            "mobility": 0.1,
            "cognitive": 0.35,
            "sleep": 0.15,
            "work": 0.2,
            "social": 0.2
        },
        "triggers": [
            "high_protein_intake",
            "stress",
            "illness",
            "aspartame_consumption"
        ],
        "red_flags": {
            "neurotoxicity_crisis": {
                "symptoms": [
                    "tremors",
                    "mood_swings"
                ],
                "z_threshold": 2.5
            }
        },
        "baseline_window_days": 14,
        "min_observations": 5
    },
    "WD": {
        "name": "Wilson Disease",
        "symptoms": [
            "tremors",
            "jaundice",
            "fatigue",
            "abdominal_pain",
            "coordination_loss",
            "mood_swings",
            "speech_difficulty"
        ],
        "symptom_labels": {
            "tremors": "Tremors",
            "jaundice": "Jaundice/Yellowing",
            "fatigue": "Fatigue",
            "abdominal_pain": "Abdominal Pain",
            "coordination_loss": "Coordination Loss",
            "mood_swings": "Mood Swings",
            "speech_difficulty": "Speech Difficulty"
        },
        "fis_domain_weights": {
            "mobility": {
                "coordination_loss": 0.6,
                "tremors": 0.4
            },
            "cognitive": {
                "mood_swings": 1.0
            },
            "sleep": {
                "fatigue": 0.7,
                "abdominal_pain": 0.3
            },
            "work": {
                "speech_difficulty": 0.4,
                "coordination_loss": 0.3,
                "fatigue": 0.3
            },
            "social": {
                "speech_difficulty": 0.5,
                "mood_swings": 0.5
            }
        },
        "domain_weights": {
            "mobility": 0.3,
            "cognitive": 0.2,
            "sleep": 0.15,
            "work": 0.2,
            "social": 0.15
        },
        "triggers": [
            "copper_intake",
            "medication_noncompliance",
            "stress",
            "infection"
        ],
        "red_flags": {
            "hepatic_failure_risk": {
                "symptoms": [
                    "jaundice",
                    "abdominal_pain"
                ],
                "z_threshold": 2.5
            },
            "neurologic_crisis": {
                "symptoms": [
                    "coordination_loss",
                    "tremors"
                ],
                "z_threshold": 2.5
            }
        },
        "baseline_window_days": 21,
        "min_observations": 7
    },
    "Pompe": {
        "name": "Pompe Disease",
        "symptoms": [
            "muscle_weakness",
            "shortness_of_breath",
            "fatigue",
            "mobility_issues",
            "orthopnea",
            "swallowing_difficulty"
        ],
        "symptom_labels": {
            "muscle_weakness": "Muscle Weakness",
            "shortness_of_breath": "Shortness of Breath",
            "fatigue": "Fatigue",
            "mobility_issues": "Mobility Issues",
            "orthopnea": "Difficulty Breathing Lying Down",
            "swallowing_difficulty": "Swallowing Difficulty"
        },
        "fis_domain_weights": {
            "mobility": {
                "mobility_issues": 0.6,
                "muscle_weakness": 0.4
            },
            "cognitive": {
                "fatigue": 1.0
            },
            "sleep": {
                "orthopnea": 0.8,
                "fatigue": 0.2
            },
            "work": {
                "muscle_weakness": 0.4,
                "fatigue": 0.4,
                "shortness_of_breath": 0.2
            },
            "social": {
                "swallowing_difficulty": 0.6,
                "fatigue": 0.4
            }
        },
        "domain_weights": {
            "mobility": 0.35,
            "cognitive": 0.1,
            "sleep": 0.25,
            "work": 0.15,
            "social": 0.15
        },
        "triggers": [
            "exertion",
            "respiratory_infection",
            "fatigue",
            "immobility"
        ],
        "red_flags": {
            "respiratory_crisis": {
                "symptoms": [
                    "shortness_of_breath",
                    "orthopnea"
                ],
                "z_threshold": 2.5
            }
        },
        "baseline_window_days": 21,
        "min_observations": 7
    },
    "TS": {
        "name": "Tay-Sachs Disease",
        "symptoms": [
            "motor_regression",
            "seizures",
            "vision_loss",
            "swallowing_difficulty",
            "respiratory_distress",
            "spasticity"
        ],
        "symptom_labels": {
            "motor_regression": "Motor Skill Regression",
            "seizures": "Seizures",
            "vision_loss": "Vision Loss",
            "swallowing_difficulty": "Swallowing Difficulty",
            "respiratory_distress": "Respiratory Distress",
            "spasticity": "Spasticity/Muscle Stiffness"
        },
        "fis_domain_weights": {
            "mobility": {
                "motor_regression": 0.6,
                "spasticity": 0.4
            },
            "cognitive": {
                "vision_loss": 1.0
            },
            "sleep": {
                "seizures": 0.6,
                "respiratory_distress": 0.4
            },
            "work": {
                "motor_regression": 0.5,
                "vision_loss": 0.5
            },
            "social": {
                "swallowing_difficulty": 0.5,
                "seizures": 0.5
            }
        },
        "domain_weights": {
            "mobility": 0.3,
            "cognitive": 0.2,
            "sleep": 0.2,
            "work": 0.1,
            "social": 0.2
        },
        "triggers": [
            "illness",
            "fever",
            "aspiration",
            "stress"
        ],
        "red_flags": {
            "seizure_crisis": {
                "symptoms": [
                    "seizures"
                ],
                "any_occurrence_threshold": 1
            }
        },
        "baseline_window_days": 14,
        "min_observations": 5
    },
    "Gaucher": {
        "name": "Gaucher Disease",
        "symptoms": [
            "bone_pain",
            "fatigue",
            "easy_bruising",
            "abdominal_fullness",
            "joint_pain",
            "cognitive_decline"
        ],
        "symptom_labels": {
            "bone_pain": "Bone Pain",
            "fatigue": "Fatigue",
            "easy_bruising": "Easy Bruising/Bleeding",
            "abdominal_fullness": "Abdominal Fullness/Pain",
            "joint_pain": "Joint Pain",
            "cognitive_decline": "Cognitive Decline (Type 3)"
        },
        "fis_domain_weights": {
            "mobility": {
                "bone_pain": 0.6,
                "joint_pain": 0.4
            },
            "cognitive": {
                "cognitive_decline": 0.8,
                "fatigue": 0.2
            },
            "sleep": {
                "bone_pain": 0.7,
                "fatigue": 0.3
            },
            "work": {
                "fatigue": 0.4,
                "bone_pain": 0.3,
                "cognitive_decline": 0.3
            },
            "social": {
                "fatigue": 0.5,
                "easy_bruising": 0.5
            }
        },
        "domain_weights": {
            "mobility": 0.3,
            "cognitive": 0.2,
            "sleep": 0.2,
            "work": 0.2,
            "social": 0.1
        },
        "triggers": [
            "exertion",
            "trauma",
            "infection",
            "stress"
        ],
        "red_flags": {
            "bone_crisis": {
                "symptoms": [
                    "bone_pain"
                ],
                "z_threshold": 3.0
            }
        },
        "baseline_window_days": 21,
        "min_observations": 7
    },
    "Alkaptonuria": {
        "name": "Alkaptonuria",
        "symptoms": [
            "joint_pain",
            "back_pain",
            "stiffness",
            "fatigue",
            "kidney_pain",
            "urine_color_change"
        ],
        "symptom_labels": {
            "joint_pain": "Joint Pain",
            "back_pain": "Back Pain",
            "stiffness": "Stiffness",
            "fatigue": "Fatigue",
            "kidney_pain": "Kidney/Flank Pain",
            "urine_color_change": "Dark Urine"
        },
        "fis_domain_weights": {
            "mobility": {
                "joint_pain": 0.4,
                "back_pain": 0.4,
                "stiffness": 0.2
            },
            "cognitive": {
                "fatigue": 1.0
            },
            "sleep": {
                "back_pain": 0.6,
                "joint_pain": 0.4
            },
            "work": {
                "stiffness": 0.5,
                "fatigue": 0.5
            },
            "social": {
                "fatigue": 0.5,
                "joint_pain": 0.5
            }
        },
        "domain_weights": {
            "mobility": 0.4,
            "cognitive": 0.1,
            "sleep": 0.25,
            "work": 0.15,
            "social": 0.1
        },
        "triggers": [
            "high_protein_intake",
            "exertion",
            "cold_weather",
            "dehydration"
        ],
        "red_flags": {
            "kidney_stone_crisis": {
                "symptoms": [
                    "kidney_pain",
                    "urine_color_change"
                ],
                "z_threshold": 2.5
            }
        },
        "baseline_window_days": 30,
        "min_observations": 10
    },
    "Achondroplasia": {
        "name": "Achondroplasia",
        "symptoms": [
            "back_pain",
            "leg_pain",
            "sleep_apnea",
            "fatigue",
            "mobility_issues",
            "numbness"
        ],
        "symptom_labels": {
            "back_pain": "Back/Spinal Pain",
            "leg_pain": "Leg Pain",
            "sleep_apnea": "Apnea/Breathing Issues",
            "fatigue": "Fatigue",
            "mobility_issues": "Mobility Limitations",
            "numbness": "Numbness/Tingling"
        },
        "fis_domain_weights": {
            "mobility": {
                "mobility_issues": 0.5,
                "leg_pain": 0.3,
                "back_pain": 0.2
            },
            "cognitive": {
                "fatigue": 1.0
            },
            "sleep": {
                "sleep_apnea": 0.7,
                "back_pain": 0.3
            },
            "work": {
                "fatigue": 0.4,
                "back_pain": 0.3,
                "numbness": 0.3
            },
            "social": {
                "mobility_issues": 0.6,
                "fatigue": 0.4
            }
        },
        "domain_weights": {
            "mobility": 0.35,
            "cognitive": 0.1,
            "sleep": 0.25,
            "work": 0.15,
            "social": 0.15
        },
        "triggers": [
            "exertion",
            "prolonged_standing",
            "weight_gain",
            "sleep_deprivation"
        ],
        "red_flags": {
            "spinal_compression": {
                "symptoms": [
                    "numbness",
                    "back_pain"
                ],
                "z_threshold": 2.5
            }
        },
        "baseline_window_days": 21,
        "min_observations": 7
    },
    "RRP": {
        "name": "Recurrent Respiratory Papillomatosis",
        "symptoms": [
            "hoarseness",
            "shortness_of_breath",
            "stridor",
            "chronic_cough",
            "swallowing_difficulty",
            "fatigue"
        ],
        "symptom_labels": {
            "hoarseness": "Hoarseness/Voice Changes",
            "shortness_of_breath": "Shortness of Breath",
            "stridor": "Stridor (Noisy Breathing)",
            "chronic_cough": "Chronic Cough",
            "swallowing_difficulty": "Swallowing Difficulty",
            "fatigue": "Fatigue"
        },
        "fis_domain_weights": {
            "mobility": {
                "shortness_of_breath": 0.7,
                "fatigue": 0.3
            },
            "cognitive": {
                "fatigue": 1.0
            },
            "sleep": {
                "stridor": 0.6,
                "chronic_cough": 0.4
            },
            "work": {
                "hoarseness": 0.6,
                "shortness_of_breath": 0.4
            },
            "social": {
                "hoarseness": 0.7,
                "chronic_cough": 0.3
            }
        },
        "domain_weights": {
            "mobility": 0.2,
            "cognitive": 0.1,
            "sleep": 0.2,
            "work": 0.25,
            "social": 0.25
        },
        "triggers": [
            "vocal_strain",
            "respiratory_infection",
            "allergens",
            "GERD"
        ],
        "red_flags": {
            "airway_obstruction": {
                "symptoms": [
                    "stridor",
                    "shortness_of_breath"
                ],
                "z_threshold": 2.5
            }
        },
        "baseline_window_days": 14,
        "min_observations": 5
    },
    "PRION": {
        "name": "Prion Disease",
        "symptoms": [
            "rapid_cognitive_decline",
            "myoclonus",
            "ataxia",
            "vision_changes",
            "speech_difficulty",
            "behavioral_changes",
            "sleep_disturbances"
        ],
        "symptom_labels": {
            "rapid_cognitive_decline": "Rapid Cognitive Decline",
            "myoclonus": "Myoclonus (Muscle Jerks)",
            "ataxia": "Ataxia/Balance Loss",
            "vision_changes": "Vision Changes",
            "speech_difficulty": "Speech Difficulty",
            "behavioral_changes": "Behavioral Changes",
            "sleep_disturbances": "Severe Sleep Disturbances"
        },
        "fis_domain_weights": {
            "mobility": {
                "ataxia": 0.6,
                "myoclonus": 0.4
            },
            "cognitive": {
                "rapid_cognitive_decline": 0.7,
                "behavioral_changes": 0.3
            },
            "sleep": {
                "sleep_disturbances": 1.0
            },
            "work": {
                "rapid_cognitive_decline": 0.5,
                "speech_difficulty": 0.3,
                "ataxia": 0.2
            },
            "social": {
                "behavioral_changes": 0.5,
                "speech_difficulty": 0.5
            }
        },
        "domain_weights": {
            "mobility": 0.25,
            "cognitive": 0.35,
            "sleep": 0.15,
            "work": 0.1,
            "social": 0.15
        },
        "triggers": [
            "stress",
            "fatigue",
            "medications",
            "illness"
        ],
        "red_flags": {
            "rapid_progression_crisis": {
                "symptoms": [
                    "rapid_cognitive_decline",
                    "myoclonus"
                ],
                "z_threshold": 2.0
            }
        },
        "baseline_window_days": 7,
        "min_observations": 4
    }
}
DISEASE_CONFIGS.update(NEW_DISEASES)

REQUIRED_GLOBAL_SYMPTOMS = {
    "sleep_quality": {
        "label": "Sleep Quality (inverse)",
        "hpo": "HP:0002360",
    },
    "stress_symptom_severity": {
        "label": "Stress",
        "hpo": "HP:0000739",
    },
}


def _ensure_required_global_symptoms():
    for config in DISEASE_CONFIGS.values():
        symptoms = config.setdefault("symptoms", [])
        symptom_labels = config.setdefault("symptom_labels", {})
        fis_domain_weights = config.setdefault("fis_domain_weights", {})
        hpo_terms = config.setdefault("hpo_terms", {})

        for symptom_key, meta in REQUIRED_GLOBAL_SYMPTOMS.items():
            if symptom_key not in symptoms:
                symptoms.append(symptom_key)
            symptom_labels.setdefault(symptom_key, meta["label"])
            hpo_terms.setdefault(symptom_key, meta["hpo"])

        fis_domain_weights.setdefault("sleep", {})
        fis_domain_weights["sleep"].setdefault("sleep_quality", 0.35)

        fis_domain_weights.setdefault("cognitive", {})
        fis_domain_weights["cognitive"].setdefault("stress_symptom_severity", 0.2)

        fis_domain_weights.setdefault("work", {})
        fis_domain_weights["work"].setdefault("stress_symptom_severity", 0.2)

        fis_domain_weights.setdefault("social", {})
        fis_domain_weights["social"].setdefault("stress_symptom_severity", 0.25)


# --- AUTOMATICALLY INJECTED HPO MAPPINGS ---
HPO_MAPPINGS = {
    "ENS": {
        "nasal_dryness": "HP:0012338",
        "crusting": "HP:0012340",
        "paradoxical_obstruction": "HP:0012338",
        "phantom_sensation": "HP:0012423",
        "anxiety": "HP:0000739",
        "depression": "HP:0000716",
        "sleep_quality": "HP:0002360",
        "fatigue": "HP:0012378",
        "pain": "HP:0012531"
    },
    "EDS": {
        "joint_pain": "HP:0002829",
        "fatigue": "HP:0012378",
        "skin_fragility": "HP:0001030",
        "proprioception_loss": "HP:0032542",
        "subluxation_frequency": "HP:0002829",
        "gi_symptoms": "HP:0011024",
        "pots_symptoms": "HP:0001662",
        "sleep_quality": "HP:0002360",
        "brain_fog": "HP:0002315",
        "anxiety": "HP:0000739"
    },
    "POTS": {
        "dizziness": "HP:0002321",
        "heart_rate_elevation": "HP:0001662",
        "fatigue": "HP:0012378",
        "brain_fog": "HP:0002315",
        "syncope_nearness": "HP:0001279",
        "nausea": "HP:0002018",
        "exercise_intolerance": "HP:0003546",
        "sleep_quality": "HP:0002360",
        "anxiety": "HP:0000739",
        "gi_symptoms": "HP:0011024"
    },
    "Heterotaxy": {
        "breathlessness": "HP:0002094",
        "cyanosis": "HP:0000961",
        "fatigue": "HP:0012378",
        "exercise_intolerance": "HP:0003546",
        "palpitations": "HP:0001962",
        "oxygen_saturation_drop": "HP:0002094",
        "edema": "HP:0000969",
        "feeding_difficulty": "HP:0011968",
        "sleep_quality": "HP:0002360",
        "anxiety": "HP:0000739"
    },
    "PCD": {
        "cough_severity": "HP:0012735",
        "nasal_congestion": "HP:0001742",
        "breathlessness": "HP:0002094",
        "sputum_production": "HP:0006536",
        "chest_tightness": "HP:0012531",
        "fatigue": "HP:0012378",
        "infection_frequency": "HP:0002719",
        "sleep_quality": "HP:0002360",
        "exercise_intolerance": "HP:0003546",
        "hearing_issues": "HP:0000365"
    },
    "FMF": {
        "fever": "HP:0001945",
        "abdominal_pain": "HP:0002027",
        "chest_pain": "HP:0100749",
        "joint_pain": "HP:0002829",
        "fatigue": "HP:0012378",
        "muscle_aches": "HP:0003326",
        "skin_rash": "HP:0000988",
        "sleep_quality": "HP:0002360",
        "anxiety": "HP:0000739",
        "brain_fog": "HP:0002315"
    },
    "CF": {
        "cough_severity": "HP:0012735",
        "breathlessness": "HP:0002094",
        "fatigue": "HP:0012378",
        "sputum_production": "HP:0006536",
        "chest_tightness": "HP:0100749",
        "sleep_quality": "HP:0002360",
        "anxiety": "HP:0000739"
    },
    "HD": {
        "chorea": "HP:0002072",
        "cognitive_decline": "HP:0001268",
        "depression": "HP:0000716",
        "irritability": "HP:0000737",
        "sleep_quality": "HP:0002360",
        "fatigue": "HP:0012378",
        "balance_issues": "HP:0002172"
    },
    "RTT": {
        "motor_regression": "HP:0001268",
        "breathing_irregularities": "HP:0002094",
        "seizures": "HP:0001250",
        "sleep_disturbances": "HP:0002360",
        "irritability": "HP:0000737",
        "scoliosis_pain": "HP:0002650"
    },
    "MFS": {
        "chest_pain": "HP:0100749",
        "palpitations": "HP:0001962",
        "joint_pain": "HP:0002829",
        "fatigue": "HP:0012378",
        "vision_changes": "HP:0000505",
        "back_pain": "HP:0003419",
        "shortness_of_breath": "HP:0002094"
    },
    "SMA": {
        "muscle_weakness": "HP:0001324",
        "swallowing_difficulty": "HP:0002015",
        "respiratory_distress": "HP:0002098",
        "fatigue": "HP:0012378",
        "joint_contracture_pain": "HP:0002829",
        "sleep_quality": "HP:0002360"
    },
    "FXS": {
        "anxiety": "HP:0000739",
        "hyperactivity": "HP:0000752",
        "sensory_overload": "HP:0000739",
        "sleep_disturbances": "HP:0002360",
        "attention_issues": "HP:0000736",
        "aggression": "HP:0000718"
    },
    "NF1": {
        "nerve_pain": "HP:0012531",
        "headaches": "HP:0002315",
        "fatigue": "HP:0012378",
        "vision_changes": "HP:0000505",
        "learning_difficulties": "HP:0001249",
        "bone_pain": "HP:0002650",
        "anxiety": "HP:0000739"
    },
    "PKU": {
        "brain_fog": "HP:0002315",
        "mood_swings": "HP:0000716",
        "tremors": "HP:0001337",
        "focus_issues": "HP:0000736",
        "fatigue": "HP:0012378",
        "headaches": "HP:0002315"
    },
    "WD": {
        "tremors": "HP:0001337",
        "jaundice": "HP:0000952",
        "fatigue": "HP:0012378",
        "abdominal_pain": "HP:0002027",
        "coordination_loss": "HP:0002072",
        "mood_swings": "HP:0000716",
        "speech_difficulty": "HP:0000750"
    },
    "Pompe": {
        "muscle_weakness": "HP:0001324",
        "respiratory_distress": "HP:0002098",
        "fatigue": "HP:0012378",
        "cardiomyopathy_symptoms": "HP:0001638",
        "swallowing_difficulty": "HP:0002015",
        "sleep_quality": "HP:0002360"
    },
    "TS": {
        "motor_regression": "HP:0001268",
        "vision_loss": "HP:0000505",
        "seizures": "HP:0001250",
        "startle_response": "HP:0002172",
        "swallowing_difficulty": "HP:0002015",
        "fatigue": "HP:0012378"
    },
    "Gaucher": {
        "bone_pain": "HP:0002650",
        "fatigue": "HP:0012378",
        "easy_bruising": "HP:0000978",
        "abdominal_pain": "HP:0002027",
        "bone_fractures": "HP:0002650",
        "energy_levels": "HP:0012378"
    },
    "Alkaptonuria": {
        "joint_pain": "HP:0002829",
        "back_pain": "HP:0003419",
        "stiffness": "HP:0001387",
        "urine_color_changes": "HP:0010476",
        "fatigue": "HP:0012378",
        "sleep_quality": "HP:0002360"
    },
    "Achondroplasia": {
        "back_pain": "HP:0003419",
        "leg_pain": "HP:0002829",
        "sleep_apnea_symptoms": "HP:0002360",
        "fatigue": "HP:0012378",
        "mobility_issues": "HP:0002172",
        "bowing_legs_pain": "HP:0002829"
    },
    "RRP": {
        "hoarseness": "HP:0001609",
        "breathing_difficulty": "HP:0002094",
        "chronic_cough": "HP:0012735",
        "swallowing_difficulty": "HP:0002015",
        "fatigue": "HP:0012378",
        "sleep_quality": "HP:0002360"
    },
    "PRION": {
        "rapid_cognitive_decline": "HP:0001268",
        "myoclonus": "HP:0001336",
        "ataxia": "HP:0002066",
        "speech_difficulty": "HP:0000750",
        "behavioral_changes": "HP:0000737",
        "sleep_disturbances": "HP:0002360"
    }
}
_ensure_required_global_symptoms()
for d in DISEASE_CONFIGS:
    if d in HPO_MAPPINGS:
        DISEASE_CONFIGS[d]['hpo_terms'] = HPO_MAPPINGS[d]
        for symptom_key, meta in REQUIRED_GLOBAL_SYMPTOMS.items():
            DISEASE_CONFIGS[d]['hpo_terms'].setdefault(symptom_key, meta["hpo"])
