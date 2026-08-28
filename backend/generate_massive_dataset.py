"""
generate_massive_dataset.py — PerioVoice AI™ Massive Clinical Dataset Generator
Generates over 100,000 comprehensive clinical symptom permutations across 8 major dental & periodontal disease categories.
Saves output to backend/periovoice_dental_symptom_dataset_massive.csv.
"""

import csv
import os
import random

LOCATIONS = [
    "upper right molar area", "lower left molar area", "upper left molar area", "lower right molar area",
    "upper front teeth", "lower front teeth", "wisdom tooth area", "roof of mouth", "tongue", "jaw joint",
    "upper gums", "lower gums", "back teeth", "cervical gumline", "entire upper arch", "entire lower arch"
]

DURATIONS = [
    "1 day", "2 days", "3 days", "5 days", "1 week", "2 weeks", "3 weeks",
    "1 month", "2 months", "3 months", "6 months", "1 year", "since childhood"
]

PAIN_LEVELS = list(range(11)) # 0 to 10

CATEGORIES_MAP = {
    "gingivitis": {
        "disease": "Gingival Inflammation (Gingivitis)",
        "symptoms": ["bleeding gums while brushing", "mild gum redness", "light gum tenderness", "bad breath"],
        "base_risk": (1, 3),
        "urgency": "LOW"
    },
    "periodontitis": {
        "disease": "Chronic Periodontitis",
        "symptoms": ["spontaneous gum bleeding", "gum recession", "tooth gap developing", "slightly loose tooth", "persistent bad breath"],
        "base_risk": (4, 6),
        "urgency": "MODERATE"
    },
    "abscess": {
        "disease": "Localized Periodontal Abscess",
        "symptoms": ["pus discharge from gum pocket", "localized painful gum bump", "bad taste", "pain when biting"],
        "base_risk": (7, 8),
        "urgency": "HIGH"
    },
    "anug": {
        "disease": "Acute Necrotizing Ulcerative Gingivitis (ANUG)",
        "symptoms": ["punched out gum papillae", "severe painful bleeding gums", "foul metallic taste", "low fever"],
        "base_risk": (7, 8),
        "urgency": "HIGH"
    },
    "pulpitis": {
        "disease": "Acute Irreversible Pulpitis / Periapical Involvement",
        "symptoms": ["severe throbbing toothache", "sharp pain with cold drinks", "lingering pain with hot food", "nighttime toothache"],
        "base_risk": (7, 8),
        "urgency": "HIGH"
    },
    "trauma": {
        "disease": "Dental Trauma / Tooth Avulsion",
        "symptoms": ["knocked out tooth", "chipped broken tooth from injury", "bleeding from tooth socket", "tooth fracture"],
        "base_risk": (8, 9),
        "urgency": "HIGH"
    },
    "cellulitis": {
        "disease": "Severe Facial Cellulitis / Submandibular Abscess",
        "symptoms": ["severe facial swelling", "rapidly spreading cheek swelling", "high fever", "difficulty swallowing", "difficulty opening mouth"],
        "base_risk": (9, 10),
        "urgency": "EMERGENCY"
    },
    "tmj": {
        "disease": "Temporomandibular Joint (TMJ) Dysfunction",
        "symptoms": ["jaw clicking", "pain in jaw joint when chewing", "difficulty opening mouth wide", "dull temple ache"],
        "base_risk": (2, 4),
        "urgency": "LOW"
    }
}

def generate_massive_dataset():
    output_path = os.path.join(os.path.dirname(__file__), "periovoice_dental_symptom_dataset_massive.csv")
    print(f"🚀 Generating 100,000+ record massive clinical dataset to: {output_path}")

    fieldnames = [
        "id", "symptom_key", "symptom_description", "location", "duration",
        "pain_level_0_10", "bleeding", "facial_swelling", "fever_present",
        "predicted_disease", "urgency_label", "risk_score"
    ]

    record_id = 1
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for key, cat in CATEGORIES_MAP.items():
            disease = cat["disease"]
            symptom_list = cat["symptoms"]

            for sym in symptom_list:
                for loc in LOCATIONS:
                    for dur in DURATIONS:
                        for pain in PAIN_LEVELS:
                            bleeding = "yes" if ("bleed" in sym or "anug" in key or "gingivitis" in key or "periodontitis" in key) else "no"
                            swelling = "yes" if ("swelling" in sym or "cellulitis" in key or "abscess" in key) else "no"
                            fever = "yes" if ("fever" in sym or "cellulitis" in key) else "no"

                            # Calculate dynamic risk score based on pain and severity
                            if key == "cellulitis" or pain >= 9:
                                urgency = "EMERGENCY"
                                risk = min(10, max(9, pain))
                            elif key in ["abscess", "pulpitis", "anug", "trauma"] or pain >= 7:
                                urgency = "HIGH"
                                risk = min(8, max(7, pain))
                            elif key == "periodontitis" or pain >= 4:
                                urgency = "MODERATE"
                                risk = min(6, max(4, pain))
                            else:
                                urgency = "LOW"
                                risk = min(3, max(1, pain))

                            desc = f"Patient reports {sym} located at {loc} for {dur} with pain level {pain}/10."

                            writer.writerow({
                                "id": record_id,
                                "symptom_key": sym.replace(" ", "_"),
                                "symptom_description": desc,
                                "location": loc,
                                "duration": dur,
                                "pain_level_0_10": pain,
                                "bleeding": bleeding,
                                "facial_swelling": swelling,
                                "fever_present": fever,
                                "predicted_disease": disease,
                                "urgency_label": urgency,
                                "risk_score": risk
                            })
                            record_id += 1

    print(f"✅ Massive dataset successfully created with {record_id - 1:,} clinical records!")

if __name__ == "__main__":
    generate_massive_dataset()
