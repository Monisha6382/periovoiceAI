"""
PDF Generator for PerioVoice AI
Generates professional PDF reports of assessments.

Uses ReportLab to create PDFs with:
- Assessment details
- Risk gauge visualization
- Symptoms and recommendations
- Home care tips
- Medical disclaimer
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from io import BytesIO
from datetime import datetime
from backend.models import UrgencyLevel


class PDFGenerator:
    """
    Generates professional PDF reports for dental assessments.
    """

    def __init__(self):
        """Initialize PDF generator."""
        self.colors_map = {
            UrgencyLevel.LOW: colors.HexColor('#4CAF50'),
            UrgencyLevel.MODERATE: colors.HexColor('#FFC107'),
            UrgencyLevel.HIGH: colors.HexColor('#F44336'),
            UrgencyLevel.EMERGENCY: colors.HexColor('#9C27B0'),
        }

    def generate_report(self, assessment_data: dict) -> bytes:
        """
        Generate a complete PDF report for an assessment.

        Parameters:
        - assessment_data: Dictionary containing:
          - user_name: User's name
          - date: Assessment date
          - urgency_level: UrgencyLevel enum
          - risk_score: 1-10 risk score
          - symptoms_found: List of symptoms
          - recommendation: Recommendation text
          - home_care_tips: List of care tips
          - conversation_transcript: Chat history
          - detected_from_image: Image analysis text (optional)

        Returns:
        - PDF file as bytes
        """
        # Create PDF in memory
        pdf_buffer = BytesIO()
        doc = SimpleDocTemplate(
            pdf_buffer,
            pagesize=letter,
            rightMargin=0.5 * inch,
            leftMargin=0.5 * inch,
            topMargin=0.5 * inch,
            bottomMargin=0.5 * inch,
        )

        # Get styles
        styles = getSampleStyleSheet()
        story = []

        # ========== HEADER ==========
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#00897B'),
            spaceAfter=6,
            alignment=1,  # Center
            fontName='Helvetica-Bold',
        )
        story.append(Paragraph('PerioVoice AI™', title_style))

        subtitle_style = ParagraphStyle(
            'Subtitle',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#666666'),
            spaceAfter=12,
            alignment=1,  # Center
        )
        story.append(
            Paragraph(
                'Periodontal Symptom Assessment Report',
                subtitle_style,
            )
        )

        # ========== ASSESSMENT INFO ==========
        urgency_level = assessment_data.get('urgency_level', UrgencyLevel.LOW)
        if isinstance(urgency_level, str):
            try:
                urgency_level = UrgencyLevel[urgency_level]
            except KeyError:
                urgency_level = UrgencyLevel.LOW

        info_data = [
            ['Assessment Date:', datetime.now().strftime('%B %d, %Y at %I:%M %p')],
            ['Patient Name:', assessment_data.get('user_name', 'N/A')],
            [
                'Urgency Level:',
                urgency_level.value,
            ],
            ['Risk Score:', f"{assessment_data.get('risk_score', 0)}/10"],
        ]

        info_table = Table(info_data, colWidths=[2 * inch, 4 * inch])
        info_table.setStyle(
            TableStyle(
                [
                    ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f0f0')),
                    ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                    ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#cccccc')),
                ]
            )
        )

        story.append(info_table)
        story.append(Spacer(1, 0.2 * inch))

        # ========== URGENCY BADGE ==========
        urgency = assessment_data.get('urgency_level', UrgencyLevel.LOW)
        urgency_color = self.colors_map.get(urgency, colors.HexColor('#4CAF50'))

        urgency_style = ParagraphStyle(
            'UrgencyStyle',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=urgency_color,
            spaceAfter=12,
            fontName='Helvetica-Bold',
        )

        urgency_map = {
            UrgencyLevel.LOW: '🟢 LOW RISK - Home care is sufficient',
            UrgencyLevel.MODERATE: '🟡 MODERATE - See dentist within 1-2 weeks',
            UrgencyLevel.HIGH: '🔴 HIGH URGENCY - See dentist within 48 hours',
            UrgencyLevel.EMERGENCY: '🚨 EMERGENCY - Seek immediate dental care',
        }

        story.append(Paragraph(urgency_map.get(urgency, 'Unknown'), urgency_style))
        story.append(Spacer(1, 0.15 * inch))

        # ========== SYMPTOMS ==========
        story.append(Paragraph('Detected Symptoms', styles['Heading3']))
        symptoms = assessment_data.get('symptoms_found', [])
        symptoms_text = ', '.join([sym.replace('_', ' ').title() for sym in symptoms])
        story.append(Paragraph(symptoms_text or 'None detected', styles['Normal']))
        story.append(Spacer(1, 0.15 * inch))

        # ========== RECOMMENDATION ==========
        story.append(Paragraph('Medical Recommendation', styles['Heading3']))
        recommendation = assessment_data.get(
            'recommendation',
            'Please consult a dental professional.',
        )
        story.append(Paragraph(recommendation, styles['Normal']))
        story.append(Spacer(1, 0.15 * inch))

        # ========== HOME CARE TIPS ==========
        home_care = assessment_data.get('home_care_tips', [])
        if home_care:
            story.append(Paragraph('Home Care Recommendations', styles['Heading3']))
            for i, tip in enumerate(home_care, 1):
                story.append(
                    Paragraph(f'{i}. {tip}', ParagraphStyle(
                        'BulletStyle',
                        parent=styles['Normal'],
                        leftIndent=0.3 * inch,
                        spaceAfter=4,
                    ))
                )
            story.append(Spacer(1, 0.15 * inch))

        # ========== IMAGE ANALYSIS (if available) ==========
        if assessment_data.get('detected_from_image'):
            story.append(Paragraph('Image Analysis Findings', styles['Heading3']))
            story.append(
                Paragraph(
                    assessment_data['detected_from_image'],
                    styles['Normal'],
                )
            )
            story.append(Spacer(1, 0.15 * inch))

        # ========== CONVERSATION SUMMARY ==========
        transcript = assessment_data.get('conversation_transcript', [])
        if transcript:
            story.append(Paragraph('Conversation Summary', styles['Heading3']))
            story.append(Spacer(1, 0.1 * inch))

            for msg in transcript[:6]:  # Show first 6 messages
                if isinstance(msg, dict):
                    speaker = 'Patient: ' if msg.get('isUser') else 'AI Assistant: '
                    story.append(
                        Paragraph(
                            f'<b>{speaker}</b> {msg.get("text", "")[:100]}...',
                            ParagraphStyle(
                                'TranscriptStyle',
                                parent=styles['Normal'],
                                fontSize=8,
                                leftIndent=0.2 * inch,
                                spaceAfter=4,
                            ),
                        )
                    )

            story.append(Spacer(1, 0.15 * inch))

        # ========== DISCLAIMER ==========
        disclaimer_style = ParagraphStyle(
            'DisclaimerStyle',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.HexColor('#CC0000'),
            leftIndent=0.2 * inch,
            rightIndent=0.2 * inch,
            spaceAfter=6,
        )

        story.append(Paragraph('<b>MEDICAL DISCLAIMER</b>', disclaimer_style))
        story.append(
            Paragraph(
                'This assessment is generated by PerioVoice AI™ and is NOT a medical diagnosis. '
                'It is based on reported symptoms and automated analysis only. '
                'A licensed dentist must perform a clinical examination for accurate diagnosis and treatment planning. '
                'In case of severe pain or emergency symptoms, seek immediate dental or medical care.',
                disclaimer_style,
            )
        )

        story.append(Spacer(1, 0.2 * inch))

        # ========== FOOTER ==========
        footer_style = ParagraphStyle(
            'FooterStyle',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.HexColor('#999999'),
            alignment=1,
        )
        story.append(
            Paragraph(
                f'Generated on {datetime.now().strftime("%Y-%m-%d %H:%M:%S")} | '
                'PerioVoice AI™ v1.0 | www.periovoice.ai',
                footer_style,
            )
        )

        # Build PDF
        doc.build(story)

        # Get PDF bytes
        pdf_bytes = pdf_buffer.getvalue()
        pdf_buffer.close()

        return pdf_bytes

    def save_report(self, assessment_data: dict, file_path: str) -> bool:
        """
        Save PDF report to file.

        Parameters:
        - assessment_data: Assessment data dictionary
        - file_path: Path to save PDF

        Returns:
        - True if successful, False otherwise
        """
        try:
            pdf_bytes = self.generate_report(assessment_data)
            with open(file_path, 'wb') as f:
                f.write(pdf_bytes)
            return True
        except Exception as e:
            print(f'Error saving PDF: {e}')
            return False


# Create a global PDF generator instance
pdf_generator = PDFGenerator()
