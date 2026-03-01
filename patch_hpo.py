import json

HPO_MAPPINGS = {
    'ENS': {'nasal_dryness': 'HP:0012338', 'crusting': 'HP:0012340', 'paradoxical_obstruction': 'HP:0012338', 'phantom_sensation': 'HP:0012423', 'anxiety': 'HP:0000739', 'depression': 'HP:0000716', 'sleep_quality': 'HP:0002360', 'fatigue': 'HP:0012378', 'pain': 'HP:0012531'},
    'EDS': {'joint_pain': 'HP:0002829', 'fatigue': 'HP:0012378', 'skin_fragility': 'HP:0001030', 'proprioception_loss': 'HP:0032542', 'subluxation_frequency': 'HP:0002829', 'gi_symptoms': 'HP:0011024', 'pots_symptoms': 'HP:0001662', 'sleep_quality': 'HP:0002360', 'brain_fog': 'HP:0002315', 'anxiety': 'HP:0000739'},
    'POTS': {'dizziness': 'HP:0002321', 'heart_rate_elevation': 'HP:0001662', 'fatigue': 'HP:0012378', 'brain_fog': 'HP:0002315', 'syncope_nearness': 'HP:0001279', 'nausea': 'HP:0002018', 'exercise_intolerance': 'HP:0003546', 'sleep_quality': 'HP:0002360', 'anxiety': 'HP:0000739', 'gi_symptoms': 'HP:0011024'},
    'Heterotaxy': {'breathlessness': 'HP:0002094', 'cyanosis': 'HP:0000961', 'fatigue': 'HP:0012378', 'exercise_intolerance': 'HP:0003546', 'palpitations': 'HP:0001962', 'oxygen_saturation_drop': 'HP:0002094', 'edema': 'HP:0000969', 'feeding_difficulty': 'HP:0011968', 'sleep_quality': 'HP:0002360', 'anxiety': 'HP:0000739'},
    'PCD': {'cough_severity': 'HP:0012735', 'nasal_congestion': 'HP:0001742', 'breathlessness': 'HP:0002094', 'sputum_production': 'HP:0006536', 'chest_tightness': 'HP:0012531', 'fatigue': 'HP:0012378', 'infection_frequency': 'HP:0002719', 'sleep_quality': 'HP:0002360', 'exercise_intolerance': 'HP:0003546', 'hearing_issues': 'HP:0000365'},
    'FMF': {'fever': 'HP:0001945', 'abdominal_pain': 'HP:0002027', 'chest_pain': 'HP:0100749', 'joint_pain': 'HP:0002829', 'fatigue': 'HP:0012378', 'muscle_aches': 'HP:0003326', 'skin_rash': 'HP:0000988', 'sleep_quality': 'HP:0002360', 'anxiety': 'HP:0000739', 'brain_fog': 'HP:0002315'},
    'CF': {'cough_severity': 'HP:0012735', 'breathlessness': 'HP:0002094', 'fatigue': 'HP:0012378', 'sputum_production': 'HP:0006536', 'chest_tightness': 'HP:0100749', 'sleep_quality': 'HP:0002360', 'anxiety': 'HP:0000739'},
    'HD': {'chorea': 'HP:0002072', 'cognitive_decline': 'HP:0001268', 'depression': 'HP:0000716', 'irritability': 'HP:0000737', 'sleep_quality': 'HP:0002360', 'fatigue': 'HP:0012378', 'balance_issues': 'HP:0002172'},
    'RTT': {'motor_regression': 'HP:0001268', 'breathing_irregularities': 'HP:0002094', 'seizures': 'HP:0001250', 'sleep_disturbances': 'HP:0002360', 'irritability': 'HP:0000737', 'scoliosis_pain': 'HP:0002650'},
    'MFS': {'chest_pain': 'HP:0100749', 'palpitations': 'HP:0001962', 'joint_pain': 'HP:0002829', 'fatigue': 'HP:0012378', 'vision_changes': 'HP:0000505', 'back_pain': 'HP:0003419', 'shortness_of_breath': 'HP:0002094'},
    'SMA': {'muscle_weakness': 'HP:0001324', 'swallowing_difficulty': 'HP:0002015', 'respiratory_distress': 'HP:0002098', 'fatigue': 'HP:0012378', 'joint_contracture_pain': 'HP:0002829', 'sleep_quality': 'HP:0002360'},
    'FXS': {'anxiety': 'HP:0000739', 'hyperactivity': 'HP:0000752', 'sensory_overload': 'HP:0000739', 'sleep_disturbances': 'HP:0002360', 'attention_issues': 'HP:0000736', 'aggression': 'HP:0000718'},
    'NF1': {'nerve_pain': 'HP:0012531', 'headaches': 'HP:0002315', 'fatigue': 'HP:0012378', 'vision_changes': 'HP:0000505', 'learning_difficulties': 'HP:0001249', 'bone_pain': 'HP:0002650', 'anxiety': 'HP:0000739'},
    'PKU': {'brain_fog': 'HP:0002315', 'mood_swings': 'HP:0000716', 'tremors': 'HP:0001337', 'focus_issues': 'HP:0000736', 'fatigue': 'HP:0012378', 'headaches': 'HP:0002315'},
    'WD': {'tremors': 'HP:0001337', 'jaundice': 'HP:0000952', 'fatigue': 'HP:0012378', 'abdominal_pain': 'HP:0002027', 'coordination_loss': 'HP:0002072', 'mood_swings': 'HP:0000716', 'speech_difficulty': 'HP:0000750'},
    'Pompe': {'muscle_weakness': 'HP:0001324', 'respiratory_distress': 'HP:0002098', 'fatigue': 'HP:0012378', 'cardiomyopathy_symptoms': 'HP:0001638', 'swallowing_difficulty': 'HP:0002015', 'sleep_quality': 'HP:0002360'},
    'TS': {'motor_regression': 'HP:0001268', 'vision_loss': 'HP:0000505', 'seizures': 'HP:0001250', 'startle_response': 'HP:0002172', 'swallowing_difficulty': 'HP:0002015', 'fatigue': 'HP:0012378'},
    'Gaucher': {'bone_pain': 'HP:0002650', 'fatigue': 'HP:0012378', 'easy_bruising': 'HP:0000978', 'abdominal_pain': 'HP:0002027', 'bone_fractures': 'HP:0002650', 'energy_levels': 'HP:0012378'},
    'Alkaptonuria': {'joint_pain': 'HP:0002829', 'back_pain': 'HP:0003419', 'stiffness': 'HP:0001387', 'urine_color_changes': 'HP:0010476', 'fatigue': 'HP:0012378', 'sleep_quality': 'HP:0002360'},
    'Achondroplasia': {'back_pain': 'HP:0003419', 'leg_pain': 'HP:0002829', 'sleep_apnea_symptoms': 'HP:0002360', 'fatigue': 'HP:0012378', 'mobility_issues': 'HP:0002172', 'bowing_legs_pain': 'HP:0002829'},
    'RRP': {'hoarseness': 'HP:0001609', 'breathing_difficulty': 'HP:0002094', 'chronic_cough': 'HP:0012735', 'swallowing_difficulty': 'HP:0002015', 'fatigue': 'HP:0012378', 'sleep_quality': 'HP:0002360'},
    'PRION': {'rapid_cognitive_decline': 'HP:0001268', 'myoclonus': 'HP:0001336', 'ataxia': 'HP:0002066', 'speech_difficulty': 'HP:0000750', 'behavioral_changes': 'HP:0000737', 'sleep_disturbances': 'HP:0002360'}
}

with open("backend/disease_config.py", "a") as f:
    f.write("\n\n# --- AUTOMATICALLY INJECTED HPO MAPPINGS ---\n")
    f.write("HPO_MAPPINGS = " + json.dumps(HPO_MAPPINGS, indent=4) + "\n")
    f.write("for d in DISEASE_CONFIGS:\n")
    f.write("    if d in HPO_MAPPINGS:\n")
    f.write("        DISEASE_CONFIGS[d]['hpo_terms'] = HPO_MAPPINGS[d]\n")
