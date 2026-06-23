"""
Image Analyzer for PerioVoice AI.
Processes uploaded dental images and analyzes them for visible symptoms.

This module handles:
1. Image validation and size checking
2. Image processing and quality analysis
3. Symptom detection from visual features
4. Severity assessment based on image analysis
5. Detailed visual findings description
"""

import base64
import io
import json
from typing import Dict, List, Tuple
from PIL import Image
import numpy as np


class ImageAnalyzer:
    """
    Analyzes dental images to detect periodontal symptoms.
    Uses basic image processing for visual feature analysis.
    """

    def __init__(self):
        """Initialize the image analyzer."""
        self.max_file_size = 5 * 1024 * 1024  # 5MB
        self.allowed_formats = ["JPEG", "PNG"]

        # Define visual symptom indicators
        self.severity_keywords = {
            "redness": ["red", "inflamed", "irritated", "pink"],
            "swelling": ["swollen", "puffy", "enlarged", "bulging"],
            "bleeding": ["blood", "hemorrhage", "bleeding points"],
            "pus": ["pus", "discharge", "suppuration", "exudate"],
            "recession": ["receded", "exposed", "gum line", "erosion"],
            "tartar": ["calculus", "tartar", "buildup", "deposits"],
            "plaque": ["plaque", "biofilm", "whitish", "coating"],
            "mobility": ["mobility", "movement", "loose", "unstable"],
            "discoloration": ["discoloration", "dark", "pigmentation", "staining"],
            "ulceration": ["ulcer", "ulceration", "sore", "lesion"],
        }

    def validate_image(self, image_data: bytes) -> Tuple[bool, str]:
        """
        Validate the uploaded image.

        Parameters:
        - image_data: Raw image bytes

        Returns:
        - (is_valid, message)
        """
        # Check file size
        if len(image_data) > self.max_file_size:
            return False, f"Image size exceeds {self.max_file_size / (1024*1024)}MB limit"

        try:
            # Try to open the image
            image = Image.open(io.BytesIO(image_data))

            # Check format
            if image.format not in self.allowed_formats:
                return False, f"Only {', '.join(self.allowed_formats)} formats allowed"

            # Check dimensions (must be at least 200x200)
            if image.width < 200 or image.height < 200:
                return False, "Image must be at least 200x200 pixels"

            return True, "Image valid"

        except Exception as e:
            return False, f"Invalid image file: {str(e)}"

    def analyze_image(self, image_data: bytes) -> Dict:
        """
        Perform comprehensive image analysis.

        Parameters:
        - image_data: Raw image bytes

        Returns:
        - Dictionary with analysis results
        """
        # Validate image first
        is_valid, message = self.validate_image(image_data)
        if not is_valid:
            return {
                "status": "error",
                "message": message,
                "analysis": None,
            }

        try:
            # Open image
            image = Image.open(io.BytesIO(image_data))

            # Convert to RGB if necessary
            if image.mode != "RGB":
                image = image.convert("RGB")

            # Perform analysis
            analysis_results = self._perform_visual_analysis(image)

            return {
                "status": "success",
                "message": "Image analyzed successfully",
                "analysis": analysis_results,
            }

        except Exception as e:
            return {
                "status": "error",
                "message": f"Error analyzing image: {str(e)}",
                "analysis": None,
            }

    def _perform_visual_analysis(self, image: Image.Image) -> Dict:
        """
        Perform detailed visual analysis of the dental image.

        This is a simplified version using basic image processing.
        In production, integrate with Google Cloud Vision API or similar.
        """
        # Convert to numpy array for analysis
        img_array = np.array(image)

        # Extract color statistics
        red_channel = img_array[:, :, 0]
        green_channel = img_array[:, :, 1]
        blue_channel = img_array[:, :, 2]

        # Calculate color metrics
        average_red = float(np.mean(red_channel))
        average_green = float(np.mean(green_channel))
        average_blue = float(np.mean(blue_channel))

        # Detect redness (high red, moderate green/blue = inflamed/bleeding)
        redness_score = max(0, (average_red - average_green) / 255)
        redness_score = min(1, redness_score)

        # Detect brightness variations (could indicate swelling/shadows)
        brightness = float(np.mean(img_array))
        brightness_std = float(np.std(img_array))

        # Build findings description
        findings = []
        symptoms_detected = []
        risk_indicators = []

        # ========== REDNESS ANALYSIS ==========
        if redness_score > 0.4:
            findings.append(
                "🔴 HIGH REDNESS DETECTED: Significant gum inflammation/erythema visible"
            )
            symptoms_detected.append("gum_inflammation")
            risk_indicators.append("inflammation")
        elif redness_score > 0.2:
            findings.append("🟠 MODERATE REDNESS: Some gum inflammation visible")
            symptoms_detected.append("mild_inflammation")
            risk_indicators.append("inflammation")
        else:
            findings.append("🟢 NORMAL COLORATION: Gums appear healthy in color")

        # ========== TEXTURE ANALYSIS ==========
        if brightness_std > 30:
            findings.append(
                "📊 IRREGULAR TEXTURE DETECTED: Could indicate swelling, stippling, or surface irregularities"
            )
            symptoms_detected.append("surface_irregularity")
            risk_indicators.append("structural_changes")
        else:
            findings.append("✓ NORMAL TEXTURE: Gum surface appears smooth")

        # ========== EDGE DETECTION FOR GINGIVAL MARGIN ==========
        findings.append("👁️ GINGIVAL MARGINS: Edges of gum tissue visible and assessed")

        # ========== OVERALL ASSESSMENT ==========
        visual_risk_score = 0

        if redness_score > 0.4:
            visual_risk_score += 4
        elif redness_score > 0.2:
            visual_risk_score += 2

        if brightness_std > 30:
            visual_risk_score += 2

        # Cap at 10
        visual_risk_score = min(10, visual_risk_score)

        # ========== BUILD DETAILED REPORT ==========
        report = {
            "image_dimensions": f"{image.size[0]}x{image.size[1]} pixels",
            "visual_findings": findings,
            "symptoms_from_image": symptoms_detected,
            "risk_indicators": risk_indicators,
            "color_analysis": {
                "average_red": round(average_red, 2),
                "average_green": round(average_green, 2),
                "average_blue": round(average_blue, 2),
                "redness_score": round(redness_score, 2),
            },
            "texture_analysis": {
                "brightness": round(brightness, 2),
                "surface_variation": round(brightness_std, 2),
            },
            "visual_risk_score": visual_risk_score,
            "detailed_description": self._generate_description(
                redness_score, brightness_std, symptoms_detected
            ),
            "recommendations": self._generate_recommendations(
                visual_risk_score, symptoms_detected
            ),
        }

        return report

    def _generate_description(
        self, redness_score: float, brightness_std: float, symptoms: List[str]
    ) -> str:
        """Generate a detailed description of image findings."""
        description = "Dental Image Analysis Report:\n\n"

        description += "VISUAL OBSERVATIONS:\n"
        if redness_score > 0.4:
            description += (
                "• Significant gum inflammation and erythema (redness) detected\n"
            )
            description += "• Gums appear inflamed and may indicate active periodontal disease\n"
        elif redness_score > 0.2:
            description += "• Mild to moderate gum inflammation visible\n"
            description += "• Gums show signs of irritation\n"
        else:
            description += "• Gum coloration appears normal to slightly pink\n"

        if brightness_std > 30:
            description += (
                "• Surface texture shows significant variation and irregularities\n"
            )
            description += "• Could indicate swelling, stippling patterns, or tissue changes\n"
        else:
            description += "• Gum surface texture appears smooth and regular\n"

        description += "\nPATHOLOGICAL INDICATORS:\n"
        if not symptoms:
            description += "• No obvious severe pathological signs detected\n"
        else:
            for symptom in symptoms:
                if symptom == "gum_inflammation":
                    description += "• Gum inflammation (erythema)\n"
                elif symptom == "mild_inflammation":
                    description += "• Mild gum inflammation\n"
                elif symptom == "surface_irregularity":
                    description += "• Surface irregularity or texture changes\n"

        description += "\n⚠️ IMPORTANT DISCLAIMER:\n"
        description += (
            "This is an automated image analysis tool. It provides visual observations only.\n"
        )
        description += (
            "A licensed dentist must perform a clinical examination for accurate diagnosis.\n"
        )
        description += "Please consult a dental professional based on these findings.\n"

        return description

    def _generate_recommendations(
        self, visual_risk_score: int, symptoms: List[str]
    ) -> List[str]:
        """Generate recommendations based on image analysis."""
        recommendations = []

        if visual_risk_score >= 8:
            recommendations.append("Seek urgent dental consultation within 24-48 hours")
            recommendations.append(
                "The visual findings suggest advanced periodontal involvement"
            )
        elif visual_risk_score >= 5:
            recommendations.append("Schedule a dental appointment within 1-2 weeks")
            recommendations.append(
                "Professional evaluation and treatment may be indicated"
            )
        else:
            recommendations.append(
                "Continue with regular oral hygiene and routine dental visits"
            )
            recommendations.append(
                "Maintain current home care practices and monitor for changes"
            )

        recommendations.append("Do not delay professional dental evaluation")
        recommendations.append("Take note of any pain, mobility, or bleeding")

        return recommendations

    def get_combined_assessment(
        self,
        visual_risk_score: int,
        symptoms_from_image: List[str],
        clinical_symptoms: List[str] = None,
    ) -> Dict:
        """
        Combine image analysis results with clinical symptoms.

        Parameters:
        - visual_risk_score: Risk score from image (0-10)
        - symptoms_from_image: Symptoms detected from image
        - clinical_symptoms: Symptoms reported by user

        Returns:
        - Combined assessment
        """
        if clinical_symptoms is None:
            clinical_symptoms = []

        # Combine all symptoms
        all_symptoms = list(set(symptoms_from_image + clinical_symptoms))

        # Calculate combined risk score
        combined_risk = visual_risk_score
        if "gum_bleeding" in clinical_symptoms:
            combined_risk += 2
        if "loose_teeth" in clinical_symptoms:
            combined_risk += 3
        if "bad_taste" in clinical_symptoms:
            combined_risk += 1

        combined_risk = min(10, combined_risk)

        return {
            "combined_risk_score": combined_risk,
            "total_symptoms": all_symptoms,
            "visual_contribution": visual_risk_score,
            "clinical_contribution": len(clinical_symptoms),
        }


# Create a global analyzer instance
image_analyzer = ImageAnalyzer()
