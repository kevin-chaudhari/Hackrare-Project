import json

new_diseases = {
    "CF": {
        "name": "Cystic Fibrosis",
        "symptoms": ["cough_severity", "breathlessness", "fatigue", "sputum_production", "chest_tightness", "sleep_quality", "anxiety"],
        "symptom_labels": {"cough_severity": "Cough Severity", "breathlessness": "Breathlessness", "fatigue": "Fatigue", "sputum_production": "Sputum Production", "chest_tightness": "Chest Tightness", "sleep_quality": "Sleep Quality (inverse)", "anxiety": "Anxiety"},
        "fis_domain_weights": {"mobility": {"breathlessness": 0.5, "fatigue": 0.5}, "cognitive": {"anxiety": 1.0}, "sleep": {"sleep_quality": 0.7, "cough_severity": 0.3}, "work": {"fatigue": 0.4, "breathlessness": 0.3, "cough_severity": 0.3}, "social": {"anxiety": 0.4, "cough_severity": 0.3, "fatigue": 0.3}},
        "domain_weights": {"mobility": 0.25, "cognitive": 0.15, "sleep": 0.20, "work": 0.25, "social": 0.15},
        "triggers": ["infection", "allergens", "cold_weather", "exertion", "stress"],
        "red_flags": {"respiratory_exacerbation": {"symptoms": ["breathlessness", "sputum_production"], "z_threshold": 2.5}},
        "baseline_window_days": 21,
        "min_observations": 7
    },
    "HD": {
        "name": "Huntington Disease",
        "symptoms": ["chorea", "cognitive_decline", "depression", "irritability", "sleep_quality", "fatigue", "balance_issues"],
        "symptom_labels": {"chorea": "Chorea/Involuntary Movements", "cognitive_decline": "Cognitive Difficulties", "depression": "Depression", "irritability": "Irritability", "sleep_quality": "Sleep Quality (inverse)", "fatigue": "Fatigue", "balance_issues": "Balance Issues"},
        "fis_domain_weights": {"mobility": {"chorea": 0.6, "balance_issues": 0.4}, "cognitive": {"cognitive_decline": 0.8, "depression": 0.2}, "sleep": {"sleep_quality": 1.0}, "work": {"cognitive_decline": 0.5, "chorea": 0.3, "fatigue": 0.2}, "social": {"irritability": 0.4, "depression": 0.3, "chorea": 0.3}},
        "domain_weights": {"mobility": 0.3, "cognitive": 0.3, "sleep": 0.1, "work": 0.15, "social": 0.15},
        "triggers": ["stress", "sleep_deprivation", "illness", "medication_changes"],
        "red_flags": {"severe_chorea_crisis": {"symptoms": ["chorea", "balance_issues"], "z_threshold": 2.5}},
        "baseline_window_days": 30,
        "min_observations": 10
    },
    "RTT": {
        "name": "Rett Syndrome",
        "symptoms": ["motor_regression", "breathing_irregularities", "seizures", "sleep_disturbances", "irritability", "scoliosis_pain"],
        "symptom_labels": {"motor_regression": "Motor Skill difficulties", "breathing_irregularities": "Breathing Irregularities", "seizures": "Seizure Activity", "sleep_disturbances": "Sleep Disturbances", "irritability": "Irritability", "scoliosis_pain": "Scoliosis Pain"},
        "fis_domain_weights": {"mobility": {"motor_regression": 0.7, "scoliosis_pain": 0.3}, "cognitive": {"irritability": 1.0}, "sleep": {"sleep_disturbances": 0.7, "seizures": 0.3}, "work": {"motor_regression": 0.6, "seizures": 0.4}, "social": {"irritability": 0.5, "seizures": 0.5}},
        "domain_weights": {"mobility": 0.35, "cognitive": 0.1, "sleep": 0.25, "work": 0.1, "social": 0.2},
        "triggers": ["stress", "illness", "fever", "sleep_deprivation"],
        "red_flags": {"seizure_cluster": {"symptoms": ["seizures"], "any_occurrence_threshold": 1}, "breathing_crisis": {"symptoms": ["breathing_irregularities"], "z_threshold": 2.5}},
        "baseline_window_days": 21,
        "min_observations": 7
    },
    "MFS": {
        "name": "Marfan Syndrome",
        "symptoms": ["chest_pain", "palpitations", "joint_pain", "fatigue", "vision_changes", "back_pain", "shortness_of_breath"],
        "symptom_labels": {"chest_pain": "Chest Pain", "palpitations": "Palpitations", "joint_pain": "Joint Pain", "fatigue": "Fatigue", "vision_changes": "Vision Changes/Blurriness", "back_pain": "Back Pain", "shortness_of_breath": "Shortness of Breath"},
        "fis_domain_weights": {"mobility": {"joint_pain": 0.5, "back_pain": 0.5}, "cognitive": {"fatigue": 1.0}, "sleep": {"fatigue": 0.5, "back_pain": 0.5}, "work": {"fatigue": 0.4, "vision_changes": 0.3, "joint_pain": 0.3}, "social": {"fatigue": 0.5, "shortness_of_breath": 0.5}},
        "domain_weights": {"mobility": 0.3, "cognitive": 0.1, "sleep": 0.2, "work": 0.2, "social": 0.2},
        "triggers": ["exertion", "stress", "heavy_lifting", "contact_sports"],
        "red_flags": {"aortic_dissection_warning": {"symptoms": ["chest_pain", "shortness_of_breath"], "z_threshold": 2.5}},
        "baseline_window_days": 21,
        "min_observations": 7
    },
    "SMA": {
        "name": "Spinal Muscular Atrophy",
        "symptoms": ["muscle_weakness", "swallowing_difficulty", "respiratory_distress", "fatigue", "joint_contracture_pain", "sleep_quality"],
        "symptom_labels": {"muscle_weakness": "Muscle Weakness", "swallowing_difficulty": "Swallowing Difficulty", "respiratory_distress": "Respiratory Distress", "fatigue": "Fatigue", "joint_contracture_pain": "Joint Contracture Pain", "sleep_quality": "Sleep Quality (inverse)"},
        "fis_domain_weights": {"mobility": {"muscle_weakness": 0.7, "joint_contracture_pain": 0.3}, "cognitive": {"fatigue": 1.0}, "sleep": {"sleep_quality": 0.6, "respiratory_distress": 0.4}, "work": {"muscle_weakness": 0.5, "fatigue": 0.5}, "social": {"swallowing_difficulty": 0.6, "fatigue": 0.4}},
        "domain_weights": {"mobility": 0.4, "cognitive": 0.1, "sleep": 0.2, "work": 0.15, "social": 0.15},
        "triggers": ["infection", "exertion", "fatigue", "cold"],
        "red_flags": {"respiratory_failure_risk": {"symptoms": ["respiratory_distress", "swallowing_difficulty"], "z_threshold": 2.5}},
        "baseline_window_days": 21,
        "min_observations": 7
    },
    "FXS": {
        "name": "Fragile X Syndrome",
        "symptoms": ["anxiety", "hyperactivity", "sensory_overload", "sleep_disturbances", "attention_issues", "aggression"],
        "symptom_labels": {"anxiety": "Anxiety", "hyperactivity": "Hyperactivity", "sensory_overload": "Sensory Overload", "sleep_disturbances": "Sleep Disturbances", "attention_issues": "Attention Issues", "aggression": "Aggressive Outbursts"},
        "fis_domain_weights": {"mobility": {"hyperactivity": 1.0}, "cognitive": {"attention_issues": 0.6, "sensory_overload": 0.4}, "sleep": {"sleep_disturbances": 1.0}, "work": {"attention_issues": 0.4, "anxiety": 0.3, "hyperactivity": 0.3}, "social": {"aggression": 0.5, "anxiety": 0.3, "sensory_overload": 0.2}},
        "domain_weights": {"mobility": 0.1, "cognitive": 0.3, "sleep": 0.2, "work": 0.2, "social": 0.2},
        "triggers": ["routine_changes", "crowds", "loud_noises", "stress", "transition_periods"],
        "red_flags": {"severe_behavioral_crisis": {"symptoms": ["aggression", "sensory_overload"], "z_threshold": 2.5}},
        "baseline_window_days": 14,
        "min_observations": 5
    },
    "NF1": {
        "name": "Neurofibromatosis Type 1",
        "symptoms": ["nerve_pain", "headaches", "fatigue", "vision_changes", "learning_difficulties", "bone_pain", "anxiety"],
        "symptom_labels": {"nerve_pain": "Nerve Pain", "headaches": "Headaches", "fatigue": "Fatigue", "vision_changes": "Vision Changes", "learning_difficulties": "Cognitive/Learning Difficulty", "bone_pain": "Bone Pain", "anxiety": "Anxiety"},
        "fis_domain_weights": {"mobility": {"bone_pain": 0.5, "nerve_pain": 0.5}, "cognitive": {"learning_difficulties": 0.7, "anxiety": 0.3}, "sleep": {"nerve_pain": 0.6, "headaches": 0.4}, "work": {"fatigue": 0.4, "learning_difficulties": 0.3, "headaches": 0.3}, "social": {"anxiety": 0.6, "fatigue": 0.4}},
        "domain_weights": {"mobility": 0.2, "cognitive": 0.25, "sleep": 0.2, "work": 0.2, "social": 0.15},
        "triggers": ["stress", "fatigue", "hormonal_changes", "illness"],
        "red_flags": {"optic_glioma_warning": {"symptoms": ["vision_changes", "headaches"], "z_threshold": 2.5}},
        "baseline_window_days": 21,
        "min_observations": 7
    },
    "PKU": {
        "name": "Phenylketonuria",
        "symptoms": ["brain_fog", "mood_swings", "tremors", "focus_issues", "fatigue", "headaches"],
        "symptom_labels": {"brain_fog": "Brain Fog", "mood_swings": "Mood Swings/Irritability", "tremors": "Tremors", "focus_issues": "Focus/Attention Issues", "fatigue": "Fatigue", "headaches": "Headaches"},
        "fis_domain_weights": {"mobility": {"tremors": 1.0}, "cognitive": {"brain_fog": 0.6, "focus_issues": 0.4}, "sleep": {"fatigue": 0.5, "headaches": 0.5}, "work": {"focus_issues": 0.5, "brain_fog": 0.3, "fatigue": 0.2}, "social": {"mood_swings": 0.8, "fatigue": 0.2}},
        "domain_weights": {"mobility": 0.1, "cognitive": 0.35, "sleep": 0.15, "work": 0.2, "social": 0.2},
        "triggers": ["high_protein_intake", "stress", "illness", "aspartame_consumption"],
        "red_flags": {"neurotoxicity_crisis": {"symptoms": ["tremors", "mood_swings"], "z_threshold": 2.5}},
        "baseline_window_days": 14,
        "min_observations": 5
    },
    "WD": {
        "name": "Wilson Disease",
        "symptoms": ["tremors", "jaundice", "fatigue", "abdominal_pain", "coordination_loss", "mood_swings", "speech_difficulty"],
        "symptom_labels": {"tremors": "Tremors", "jaundice": "Jaundice/Yellowing", "fatigue": "Fatigue", "abdominal_pain": "Abdominal Pain", "coordination_loss": "Coordination Loss", "mood_swings": "Mood Swings", "speech_difficulty": "Speech Difficulty"},
        "fis_domain_weights": {"mobility": {"coordination_loss": 0.6, "tremors": 0.4}, "cognitive": {"mood_swings": 1.0}, "sleep": {"fatigue": 0.7, "abdominal_pain": 0.3}, "work": {"speech_difficulty": 0.4, "coordination_loss": 0.3, "fatigue": 0.3}, "social": {"speech_difficulty": 0.5, "mood_swings": 0.5}},
        "domain_weights": {"mobility": 0.3, "cognitive": 0.2, "sleep": 0.15, "work": 0.2, "social": 0.15},
        "triggers": ["copper_intake", "medication_noncompliance", "stress", "infection"],
        "red_flags": {"hepatic_failure_risk": {"symptoms": ["jaundice", "abdominal_pain"], "z_threshold": 2.5}, "neurologic_crisis": {"symptoms": ["coordination_loss", "tremors"], "z_threshold": 2.5}},
        "baseline_window_days": 21,
        "min_observations": 7
    },
    "Pompe": {
        "name": "Pompe Disease",
        "symptoms": ["muscle_weakness", "shortness_of_breath", "fatigue", "mobility_issues", "orthopnea", "swallowing_difficulty"],
        "symptom_labels": {"muscle_weakness": "Muscle Weakness", "shortness_of_breath": "Shortness of Breath", "fatigue": "Fatigue", "mobility_issues": "Mobility Issues", "orthopnea": "Difficulty Breathing Lying Down", "swallowing_difficulty": "Swallowing Difficulty"},
        "fis_domain_weights": {"mobility": {"mobility_issues": 0.6, "muscle_weakness": 0.4}, "cognitive": {"fatigue": 1.0}, "sleep": {"orthopnea": 0.8, "fatigue": 0.2}, "work": {"muscle_weakness": 0.4, "fatigue": 0.4, "shortness_of_breath": 0.2}, "social": {"swallowing_difficulty": 0.6, "fatigue": 0.4}},
        "domain_weights": {"mobility": 0.35, "cognitive": 0.1, "sleep": 0.25, "work": 0.15, "social": 0.15},
        "triggers": ["exertion", "respiratory_infection", "fatigue", "immobility"],
        "red_flags": {"respiratory_crisis": {"symptoms": ["shortness_of_breath", "orthopnea"], "z_threshold": 2.5}},
        "baseline_window_days": 21,
        "min_observations": 7
    },
    "TS": {
        "name": "Tay-Sachs Disease",
        "symptoms": ["motor_regression", "seizures", "vision_loss", "swallowing_difficulty", "respiratory_distress", "spasticity"],
        "symptom_labels": {"motor_regression": "Motor Skill Regression", "seizures": "Seizures", "vision_loss": "Vision Loss", "swallowing_difficulty": "Swallowing Difficulty", "respiratory_distress": "Respiratory Distress", "spasticity": "Spasticity/Muscle Stiffness"},
        "fis_domain_weights": {"mobility": {"motor_regression": 0.6, "spasticity": 0.4}, "cognitive": {"vision_loss": 1.0}, "sleep": {"seizures": 0.6, "respiratory_distress": 0.4}, "work": {"motor_regression": 0.5, "vision_loss": 0.5}, "social": {"swallowing_difficulty": 0.5, "seizures": 0.5}},
        "domain_weights": {"mobility": 0.3, "cognitive": 0.2, "sleep": 0.2, "work": 0.1, "social": 0.2},
        "triggers": ["illness", "fever", "aspiration", "stress"],
        "red_flags": {"seizure_crisis": {"symptoms": ["seizures"], "any_occurrence_threshold": 1}},
        "baseline_window_days": 14,
        "min_observations": 5
    },
    "Gaucher": {
        "name": "Gaucher Disease",
        "symptoms": ["bone_pain", "fatigue", "easy_bruising", "abdominal_fullness", "joint_pain", "cognitive_decline"],
        "symptom_labels": {"bone_pain": "Bone Pain", "fatigue": "Fatigue", "easy_bruising": "Easy Bruising/Bleeding", "abdominal_fullness": "Abdominal Fullness/Pain", "joint_pain": "Joint Pain", "cognitive_decline": "Cognitive Decline (Type 3)"},
        "fis_domain_weights": {"mobility": {"bone_pain": 0.6, "joint_pain": 0.4}, "cognitive": {"cognitive_decline": 0.8, "fatigue": 0.2}, "sleep": {"bone_pain": 0.7, "fatigue": 0.3}, "work": {"fatigue": 0.4, "bone_pain": 0.3, "cognitive_decline": 0.3}, "social": {"fatigue": 0.5, "easy_bruising": 0.5}},
        "domain_weights": {"mobility": 0.3, "cognitive": 0.2, "sleep": 0.2, "work": 0.2, "social": 0.1},
        "triggers": ["exertion", "trauma", "infection", "stress"],
        "red_flags": {"bone_crisis": {"symptoms": ["bone_pain"], "z_threshold": 3.0}},
        "baseline_window_days": 21,
        "min_observations": 7
    },
    "Alkaptonuria": {
        "name": "Alkaptonuria",
        "symptoms": ["joint_pain", "back_pain", "stiffness", "fatigue", "kidney_pain", "urine_color_change"],
        "symptom_labels": {"joint_pain": "Joint Pain", "back_pain": "Back Pain", "stiffness": "Stiffness", "fatigue": "Fatigue", "kidney_pain": "Kidney/Flank Pain", "urine_color_change": "Dark Urine"},
        "fis_domain_weights": {"mobility": {"joint_pain": 0.4, "back_pain": 0.4, "stiffness": 0.2}, "cognitive": {"fatigue": 1.0}, "sleep": {"back_pain": 0.6, "joint_pain": 0.4}, "work": {"stiffness": 0.5, "fatigue": 0.5}, "social": {"fatigue": 0.5, "joint_pain": 0.5}},
        "domain_weights": {"mobility": 0.4, "cognitive": 0.1, "sleep": 0.25, "work": 0.15, "social": 0.1},
        "triggers": ["high_protein_intake", "exertion", "cold_weather", "dehydration"],
        "red_flags": {"kidney_stone_crisis": {"symptoms": ["kidney_pain", "urine_color_change"], "z_threshold": 2.5}},
        "baseline_window_days": 30,
        "min_observations": 10
    },
    "Achondroplasia": {
        "name": "Achondroplasia",
        "symptoms": ["back_pain", "leg_pain", "sleep_apnea", "fatigue", "mobility_issues", "numbness"],
        "symptom_labels": {"back_pain": "Back/Spinal Pain", "leg_pain": "Leg Pain", "sleep_apnea": "Apnea/Breathing Issues", "fatigue": "Fatigue", "mobility_issues": "Mobility Limitations", "numbness": "Numbness/Tingling"},
        "fis_domain_weights": {"mobility": {"mobility_issues": 0.5, "leg_pain": 0.3, "back_pain": 0.2}, "cognitive": {"fatigue": 1.0}, "sleep": {"sleep_apnea": 0.7, "back_pain": 0.3}, "work": {"fatigue": 0.4, "back_pain": 0.3, "numbness": 0.3}, "social": {"mobility_issues": 0.6, "fatigue": 0.4}},
        "domain_weights": {"mobility": 0.35, "cognitive": 0.1, "sleep": 0.25, "work": 0.15, "social": 0.15},
        "triggers": ["exertion", "prolonged_standing", "weight_gain", "sleep_deprivation"],
        "red_flags": {"spinal_compression": {"symptoms": ["numbness", "back_pain"], "z_threshold": 2.5}},
        "baseline_window_days": 21,
        "min_observations": 7
    },
    "RRP": {
        "name": "Recurrent Respiratory Papillomatosis",
        "symptoms": ["hoarseness", "shortness_of_breath", "stridor", "chronic_cough", "swallowing_difficulty", "fatigue"],
        "symptom_labels": {"hoarseness": "Hoarseness/Voice Changes", "shortness_of_breath": "Shortness of Breath", "stridor": "Stridor (Noisy Breathing)", "chronic_cough": "Chronic Cough", "swallowing_difficulty": "Swallowing Difficulty", "fatigue": "Fatigue"},
        "fis_domain_weights": {"mobility": {"shortness_of_breath": 0.7, "fatigue": 0.3}, "cognitive": {"fatigue": 1.0}, "sleep": {"stridor": 0.6, "chronic_cough": 0.4}, "work": {"hoarseness": 0.6, "shortness_of_breath": 0.4}, "social": {"hoarseness": 0.7, "chronic_cough": 0.3}},
        "domain_weights": {"mobility": 0.2, "cognitive": 0.1, "sleep": 0.2, "work": 0.25, "social": 0.25},
        "triggers": ["vocal_strain", "respiratory_infection", "allergens", "GERD"],
        "red_flags": {"airway_obstruction": {"symptoms": ["stridor", "shortness_of_breath"], "z_threshold": 2.5}},
        "baseline_window_days": 14,
        "min_observations": 5
    },
    "PRION": {
        "name": "Prion Disease",
        "symptoms": ["rapid_cognitive_decline", "myoclonus", "ataxia", "vision_changes", "speech_difficulty", "behavioral_changes", "sleep_disturbances"],
        "symptom_labels": {"rapid_cognitive_decline": "Rapid Cognitive Decline", "myoclonus": "Myoclonus (Muscle Jerks)", "ataxia": "Ataxia/Balance Loss", "vision_changes": "Vision Changes", "speech_difficulty": "Speech Difficulty", "behavioral_changes": "Behavioral Changes", "sleep_disturbances": "Severe Sleep Disturbances"},
        "fis_domain_weights": {"mobility": {"ataxia": 0.6, "myoclonus": 0.4}, "cognitive": {"rapid_cognitive_decline": 0.7, "behavioral_changes": 0.3}, "sleep": {"sleep_disturbances": 1.0}, "work": {"rapid_cognitive_decline": 0.5, "speech_difficulty": 0.3, "ataxia": 0.2}, "social": {"behavioral_changes": 0.5, "speech_difficulty": 0.5}},
        "domain_weights": {"mobility": 0.25, "cognitive": 0.35, "sleep": 0.15, "work": 0.1, "social": 0.15},
        "triggers": ["stress", "fatigue", "medications", "illness"],
        "red_flags": {"rapid_progression_crisis": {"symptoms": ["rapid_cognitive_decline", "myoclonus"], "z_threshold": 2.0}},
        "baseline_window_days": 7,
        "min_observations": 4
    }
}

import ast

with open("backend/disease_config.py", "r", encoding="utf-8") as f:
    text = f.read()

# We need to just inject `new_diseases` into DISEASE_CONFIGS inside the file.
# We can do this cleanly via string replacement since the last lines of disease_config are likely closing the dict.

# Find the last brace
idx = text.rfind("}")
if idx != -1:
    # insert an update to the dict
    pass

# Alternatively write a script that updates the file
with open("backend/disease_config.py", "a", encoding="utf-8") as f:
    f.write("\n\n" + "# Appending new diseases dynamically" + "\n")
    f.write("NEW_DISEASES = " + json.dumps(new_diseases, indent=4) + "\n")
    f.write("DISEASE_CONFIGS.update(NEW_DISEASES)\n")

print("Added diseases successfully!")
