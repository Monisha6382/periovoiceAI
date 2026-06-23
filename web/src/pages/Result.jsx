/**
 * Result Page
 * Displays the final assessment result with urgency level and recommendations
 */

import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { UrgencyBadge } from '../components/UrgencyBadge'
import { RiskGauge } from '../components/RiskGauge'
import { getAssessmentPdf } from '../utils/api'

export const Result = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state || {}
  const result = state.result || {
    urgency: 'MODERATE',
    riskScore: 6,
    symptoms: ['gum_bleeding', 'swelling', 'bad_taste'],
    recommendation: 'Schedule a dental appointment within 1-2 weeks. Professional evaluation and treatment may be indicated.',
    homeCare: [
      'Rinse with warm salt water 3-4 times daily to reduce inflammation',
      'Brush your teeth twice daily with a soft-bristled toothbrush',
      'Floss daily to remove plaque between teeth',
      'Use an antimicrobial mouthwash as recommended',
      'Avoid smoking and tobacco products',
      'Maintain a healthy diet low in sugar',
    ],
    shouldSeeDentist: true,
    detectFromImage: 'Significant gum inflammation and erythema (redness) detected. Gums appear inflamed and may indicate active periodontal disease.',
  }

  const urgency = result.urgency || result.urgency_level
  const riskScore = result.riskScore ?? result.risk_score
  const symptoms = result.symptoms || result.symptoms_found || []
  const homeCare = result.homeCare || result.home_care_tips || []
  const shouldSeeDentist = result.shouldSeeDentist ?? result.should_see_dentist
  const detectFromImage = result.detectFromImage || result.detected_from_image

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 animate-slideIn">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Assessment Complete
          </h1>
          <p className="text-gray-600">
            Here are your results and recommendations
          </p>
        </div>

        {/* Urgency Badge */}
        <div className="mb-8 animate-slideIn" style={{ animationDelay: '0.1s' }}>
            <UrgencyBadge level={urgency} riskScore={riskScore} />
        </div>

        {/* Risk Gauge */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8 animate-slideIn" style={{ animationDelay: '0.2s' }}>
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Risk Assessment
          </h2>
          <div className="flex justify-center">
              <RiskGauge score={riskScore} size="md" />
          </div>
        </div>

        {/* Recommendation */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8 animate-slideIn" style={{ animationDelay: '0.3s' }}>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            📋 Recommendation
          </h2>
          <p className="text-gray-700 text-lg mb-4">
            {result.recommendation}
          </p>
            {shouldSeeDentist && (
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
              <p className="text-yellow-700 font-semibold">
                ⚠️ Professional Dental Care Required
              </p>
              <p className="text-yellow-600 text-sm mt-1">
                Please schedule an appointment with a licensed dentist for proper diagnosis and treatment.
              </p>
            </div>
          )}
        </div>

        {/* Symptoms */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8 animate-slideIn" style={{ animationDelay: '0.4s' }}>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            🔍 Detected Symptoms
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {symptoms.map((symptom, idx) => (
              <div key={idx} className="bg-red-50 p-3 rounded-lg flex items-center gap-3">
                <span className="text-2xl">●</span>
                <span className="text-gray-700 capitalize">
                  {symptom.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Home Care */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8 animate-slideIn" style={{ animationDelay: '0.5s' }}>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            🏠 Home Care Tips
          </h2>
          <ul className="space-y-3">
              {homeCare.map((tip, idx) => (
              <li key={idx} className="flex gap-3 text-gray-700">
                <span className="text-teal-500 font-bold flex-shrink-0">✓</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Image Findings */}
          {detectFromImage && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8 animate-slideIn" style={{ animationDelay: '0.6s' }}>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              📸 Image Analysis
            </h2>
              <p className="text-gray-700">
                {detectFromImage}
            </p>
          </div>
        )}

        {/* Disclaimer */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg mb-8 animate-slideIn" style={{ animationDelay: '0.7s' }}>
          <p className="text-blue-700 font-semibold mb-2">
            ⚠️ Medical Disclaimer
          </p>
          <p className="text-blue-600 text-sm">
            This is not a medical diagnosis. PerioVoice AI provides assessment based on reported symptoms and visual analysis only.
            A licensed dentist must perform a clinical examination for accurate diagnosis and treatment planning.
            In case of severe pain or symptoms, seek immediate dental care.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-4 justify-center animate-slideIn" style={{ animationDelay: '0.8s' }}>
          <button
            onClick={() => navigate('/')}
            className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-lg transition"
          >
            Home
          </button>
          <button
            onClick={() => window.print()}
            className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 px-8 rounded-lg transition"
          >
            📄 Print / Save as PDF
          </button>
          <button
            onClick={async () => {
              if (state.pdfUrl) {
                window.open(state.pdfUrl, '_blank')
                return
              }

              if (!state.assessmentId || !state.userId) return

              try {
                const pdfData = await getAssessmentPdf(state.assessmentId, state.userId)
                const binary = atob(pdfData.pdf_base64)
                const len = binary.length
                const buffer = new Uint8Array(len)
                for (let i = 0; i < len; i += 1) {
                  buffer[i] = binary.charCodeAt(i)
                }
                const blob = new Blob([buffer], { type: 'application/pdf' })
                const url = window.URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.download = `assessment_${state.assessmentId}.pdf`
                link.click()
                window.URL.revokeObjectURL(url)
              } catch (error) {
                console.error('Error downloading PDF:', error)
              }
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg transition"
          >
            📥 Download Report PDF
          </button>
        </div>
      </div>
    </div>
  )
}
