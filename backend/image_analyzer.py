"""
image_analyzer.py — PerioVoice AI™ Computer Vision & Image Analyzer
Analyzes uploaded dental images using color histogram analysis, texture variance, and margin detection.
Outputs deterministic visual findings and maps detected features directly to symptom keys.
"""

import io
from typing import Dict, List, Tuple
from PIL import Image
import numpy as np

class ImageAnalyzer:
    """
    Analyzes dental photos to detect visual signs of periodontal disease.
    Operates 100% locally using PIL and NumPy.
    """
    def __init__(self):
        self.max_file_size = 8 * 1024 * 1024  # 8MB
        self.allowed_formats = ["JPEG", "PNG", "WEBP"]

    def validate_image(self, image_data: bytes) -> Tuple[bool, str]:
        if len(image_data) > self.max_file_size:
            return False, f"Image file size exceeds {self.max_file_size / (1024*1024)}MB limit"

        try:
            image = Image.open(io.BytesIO(image_data))
            if image.format not in self.allowed_formats:
                return False, f"Format {image.format} not allowed. Please upload JPEG, PNG, or WEBP."
            if image.width < 150 or image.height < 150:
                return False, "Image dimensions must be at least 150x150 pixels."
            return True, "Image valid"
        except Exception as e:
            return False, f"Invalid image format: {str(e)}"

    def analyze_image(self, image_data: bytes) -> Dict:
        is_valid, msg = self.validate_image(image_data)
        if not is_valid:
            return {"status": "error", "message": msg, "analysis": None}

        try:
            raw_image = Image.open(io.BytesIO(image_data))
            image = raw_image.convert("RGB")
            img_array = np.array(image)

            # Log image details right before analysis
            print(f"[IMAGE SCANNER] Analyzing image: format={raw_image.format}, size={len(image_data)} bytes, dimensions={raw_image.width}x{raw_image.height}")

            # Extract color statistics
            red_ch = img_array[:, :, 0]
            green_ch = img_array[:, :, 1]
            blue_ch = img_array[:, :, 2]

            avg_red = float(np.mean(red_ch))
            avg_green = float(np.mean(green_ch))
            avg_blue = float(np.mean(blue_ch))

            # Surface texture variation (edema / plaque / recession indicator)
            brightness_std = float(np.std(img_array))

            # Non-dental photo rejection check:
            # 1. Screen/IDE screenshot detection: Code editors, dark/blue software interfaces
            # 2. Document/text detection: Flat monochrome or dominant blue/green screens
            # 3. Absence of oral mucosal colors (pink/red tissue or ivory enamel)
            is_non_dental = False
            rejection_reason = ""

            # Convert RGB array to HSV for oral tissue color validation
            hsv_image = raw_image.convert("HSV")
            hsv_array = np.array(hsv_image)
            hue_ch = hsv_array[:, :, 0]        # 0-255 in PIL
            sat_ch = hsv_array[:, :, 1]
            val_ch = hsv_array[:, :, 2]

            # Oral mucosa / gum tissue hues in PIL HSV: Red/Pink hues are around 0-25 (0-35 deg) and 230-255 (325-360 deg)
            pink_red_mask = ((hue_ch < 28) | (hue_ch > 225)) & (sat_ch > 40) & (val_ch > 40)
            pink_red_pct = (np.sum(pink_red_mask) / (img_array.shape[0] * img_array.shape[1])) * 100.0

            # Tooth enamel mask: moderate/high brightness, low saturation
            tooth_mask_hsv = (sat_ch < 65) & (val_ch > 140)
            tooth_pct = (np.sum(tooth_mask_hsv) / (img_array.shape[0] * img_array.shape[1])) * 100.0

            # Document / Paper / Printed Text Detection (High brightness white paper background with dark text)
            is_document_paper = (avg_red > 165.0 and avg_green > 165.0 and avg_blue > 165.0) and (abs(avg_red - avg_green) < 12 and abs(avg_red - avg_blue) < 12) and (pink_red_pct < 3.5)

            if avg_red < 35.0:
                is_non_dental = True
                rejection_reason = "Image is too dark or underexposed."
            elif is_document_paper:
                is_non_dental = True
                rejection_reason = "Document / printed paper / text list detected."
            elif avg_blue > avg_red * 0.98 and avg_blue > 70:
                is_non_dental = True
                rejection_reason = "Dominant blue color profile (software UI / screen screenshot)."
            elif avg_green > avg_red * 1.02 and avg_green > 70:
                is_non_dental = True
                rejection_reason = "Dominant green color profile."
            elif brightness_std < 8.0:
                is_non_dental = True
                rejection_reason = "Flat monochrome or graphic image."
            elif pink_red_pct < 3.0 and tooth_pct < 15.0:
                is_non_dental = True
                rejection_reason = "Lacks characteristic oral tissue (pink/red gums or tooth enamel)."

            if is_non_dental:
                print(f"[IMAGE SCANNER] Rejected non-dental image. Reason: {rejection_reason} (pink_red_pct={pink_red_pct:.2f}%, tooth_pct={tooth_pct:.2f}%)")
                return {
                    "status": "error",
                    "is_dental": False,
                    "message": "⚠️ This image does not appear to be a dental or oral photo. Please upload a clear photo of your teeth, gums, or mouth area for assessment.",
                    "recommendation": "Please upload a clear photo focusing on your teeth or gums for visual analysis.",
                    "image_description": "Non-dental image rejected.",
                    "visual_risk_score": 0,
                    "detected_symptom_tags": [],
                    "findings": []
                }

            # 1. Tooth pixels (high brightness, yellowish/white enamel)
            tooth_mask = (red_ch > 135) & (green_ch > 135) & (blue_ch > 85)
            num_tooth_pixels = int(np.sum(tooth_mask))

            # 2. Cavity / decay pixels (dark brown/black spots inside enamel region)
            decay_mask = (red_ch < 110) & (green_ch < 90) & (blue_ch < 70) & (red_ch > green_ch * 1.05) & (green_ch > blue_ch * 1.05)
            num_decay_pixels = int(np.sum(decay_mask))
            pct_decay = (num_decay_pixels / (num_tooth_pixels + 1)) * 100

            # 3. Plaque / calculus pixels (yellowish-brown tartar buildup on teeth)
            plaque_mask = (red_ch > 120) & (green_ch > 110) & (blue_ch < green_ch * 0.75) & (~tooth_mask)
            num_plaque_pixels = int(np.sum(plaque_mask))
            pct_plaque = (num_plaque_pixels / (num_tooth_pixels + 1)) * 100

            # 4. Abscess / Pus spot detection (localized bright white/yellowish spots inside red tissue)
            pus_spot_mask = (red_ch > 190) & (green_ch > 185) & (blue_ch > 150) & (pink_red_mask)
            num_pus_pixels = int(np.sum(pus_spot_mask))
            pct_pus = (num_pus_pixels / (np.sum(pink_red_mask) + 1)) * 100

            # 5. Gingival Recession (exposed yellow dentin/root near tooth-gum boundary)
            recession_mask = (red_ch > 160) & (green_ch > 140) & (blue_ch < 100) & (~tooth_mask)
            pct_recession = (np.sum(recession_mask) / (img_array.shape[0] * img_array.shape[1])) * 100.0

            # 6. Redness & Edema calculation (erythema indicator)
            redness_ratio = max(0.0, (avg_red - avg_green) / 255.0)
            redness_ratio = min(1.0, redness_ratio)

            print(f"[IMAGE SCANNER] stats: avg_red={avg_red:.2f}, avg_green={avg_green:.2f}, avg_blue={avg_blue:.2f}, brightness_std={brightness_std:.2f}")
            print(f"[IMAGE SCANNER] features: decay={pct_decay:.2f}%, plaque={pct_plaque:.2f}%, pus={pct_pus:.2f}%, recession={pct_recession:.2f}%, redness={redness_ratio:.4f}")

            findings = []
            detected_tags = []

            # 1. Abscess / Pus spot detection
            if pct_pus > 1.5:
                findings.append("🚨 Localized pale/purulent pustule detected on gingival tissue (possible periodontal/periapical abscess).")
                detected_tags.append("pus_discharge")

            # 2. Decay / Cavity detection
            if pct_decay > 2.0:
                findings.append("🔍 Dark localized lesions detected on tooth enamel (potential dental caries/cavity).")
                detected_tags.append("tooth_decay_caries")

            # 3. Plaque / Calculus / Tartar detection
            if pct_plaque > 7.5:
                findings.append("⚠️ Yellowish-brown dental calculus/plaque buildup observed near the gumline.")
                detected_tags.append("plaque_calculus")

            # 4. Gingival Recession detection
            if pct_recession > 3.0:
                findings.append("📍 Gingival margin recession with root exposure detected.")
                detected_tags.append("gingival_recession")

            # 5. Gum Redness & Inflammation (Erythema)
            if redness_ratio > 0.35:
                findings.append("🔴 Significant gingival erythema and mucosal swelling detected.")
                detected_tags.append("severe_swelling")
            elif redness_ratio > 0.18:
                findings.append("🟠 Moderate gum redness visible near dental margin.")
                detected_tags.append("bleeding_gums_brushing")
            else:
                findings.append("🟢 Normal tissue pigmentation observed.")

            if brightness_std > 35.0:
                findings.append("📊 Surface texture variation observed near dental papillae.")
                if "bad_breath_halitosis" not in detected_tags:
                    detected_tags.append("bad_breath_halitosis")

            # Determine main clinical recommendation & risk score
            if "pus_discharge" in detected_tags:
                recommendation = "🚨 Localized purulent lesion detected. Please see a dentist urgently for clinical evaluation and drainage."
                visual_risk = 9
            elif "tooth_decay_caries" in detected_tags:
                recommendation = "🔍 Potential dental decay/cavity detected. Please schedule a dental exam to prevent structural damage."
                visual_risk = 7
            elif "severe_swelling" in detected_tags:
                recommendation = "🔴 Significant gum redness/inflammation detected. Professional scaling and exam recommended."
                visual_risk = 6
            elif "plaque_calculus" in detected_tags:
                recommendation = "⚠️ Plaque or calculus buildup observed. Professional dental cleaning (scaling) is recommended."
                visual_risk = 5
            elif "gingival_recession" in detected_tags:
                recommendation = "📍 Gum margin recession detected. Consult a dentist to monitor attachment loss."
                visual_risk = 4
            elif "bleeding_gums_brushing" in detected_tags:
                recommendation = "🟠 Mild-to-moderate gum redness visible. Maintain soft brushing and routine dental checkup."
                visual_risk = 3
            else:
                recommendation = "🟢 Oral tissues appear healthy. Continue daily brushing and flossing."
                visual_risk = 2

            description = (
                f"Visual Scan Report: {len(findings)} observations. "
                f"Redness score: {round(redness_ratio * 10, 1)}/10. "
                + " ".join(findings)
            )

            return {
                "status": "success",
                "message": "Image analyzed successfully",
                "image_description": description,
                "recommendation": recommendation,
                "visual_risk_score": visual_risk,
                "detected_symptom_tags": detected_tags,
                "findings": findings
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Analysis failed: {str(e)}",
                "image_description": "Visual evaluation unavailable. Please describe your symptoms in text.",
                "recommendation": "Visual evaluation failed. Please describe your symptoms in text."
            }

image_analyzer = ImageAnalyzer()
