/**
 * History Page
 * Shows past assessments and symptom trends
 */

import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getHistory } from '../utils/api'

export const History = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [assessments, setAssessments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const userId = searchParams.get('userId') || 'user_unknown'

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setIsLoading(true)
        const result = await getHistory(userId)
        setAssessments(result.assessments || [])
      } catch (err) {
        setError('Unable to load history: ' + err.message)
      } finally {
        setIsLoading(false)
      }
    }

    loadHistory()
  }, [userId])

  const getUrgencyColor = (urgency) => {
    const colors = {
      LOW: 'bg-green-50 text-green-700 border-green-200',
      MODERATE: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      HIGH: 'bg-red-50 text-red-700 border-red-200',
      EMERGENCY: 'bg-purple-50 text-purple-700 border-purple-200',
    }
    return colors[urgency] || colors.LOW
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="text-teal-600 hover:text-teal-700 mb-4 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Assessment History</h1>
          <p className="text-gray-600 mt-2">
            View your past assessments and symptom trends
          </p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-teal-600 mb-2">
              {assessments.length}
            </div>
            <p className="text-gray-600">Total Assessments</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-yellow-600 mb-2">
              {assessments.filter((a) => (a.urgency_level || a.urgency) === 'MODERATE').length}
            </div>
            <p className="text-gray-600">Moderate Cases</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {assessments.filter((a) => (a.urgency_level || a.urgency) === 'LOW').length}
            </div>
            <p className="text-gray-600">Low Risk</p>
          </div>
        </div>

        {/* Assessments List */}
        <div className="space-y-4">
          {assessments.map((assessment) => (
            <div
              key={assessment.assessment_id || assessment.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm text-gray-500">
                    {new Date(assessment.date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                  <h3 className="text-lg font-semibold text-gray-900 mt-1">
                    Assessment #{assessment.id}
                  </h3>
                </div>
                <div
                  className={`px-4 py-2 rounded-full border-2 font-semibold ${getUrgencyColor(assessment.urgency_level || assessment.urgency)}`}
                >
                  {assessment.urgency_level || assessment.urgency}
                </div>
              </div>

              <div className="flex items-center gap-6 mb-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Risk Score</p>
                  <div className="flex items-center gap-2">
                    <div className="w-40 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          assessment.riskScore <= 3
                            ? 'bg-green-500'
                            : assessment.riskScore <= 6
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${(assessment.riskScore / 10) * 100}%` }}
                      ></div>
                    </div>
                    <span className="font-semibold text-gray-900">
                      {assessment.riskScore}/10
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-2">Symptoms Detected</p>
                <div className="flex flex-wrap gap-2">
                  {(assessment.symptoms || assessment.symptoms_found || []).map((symptom, idx) => (
                    <span
                      key={idx}
                      className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-medium"
                    >
                      {symptom.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {isLoading ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <div className="animate-spin mb-4">
              <svg className="w-12 h-12 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-600">Loading assessment history...</p>
          </div>
        ) : assessments.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-gray-600">
              No assessments yet. Start a new assessment to see results here.
            </p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-6 rounded-lg transition"
            >
              Start Assessment
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
