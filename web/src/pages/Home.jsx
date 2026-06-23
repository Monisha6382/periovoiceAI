/**
 * Home Page
 * Landing page with app introduction and start button
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'

export const Home = () => {
  const navigate = useNavigate()
  const [userId, setUserId] = React.useState('')

  const handleStart = () => {
    if (userId.trim()) {
      navigate(`/chat?userId=${encodeURIComponent(userId)}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-12 animate-slideIn">
          <div className="inline-block p-4 bg-teal-100 rounded-full mb-6">
            <span className="text-4xl">🦷</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            PerioVoice AI™
          </h1>
          <p className="text-xl text-gray-600">
            AI-Driven Conversational System for Periodontal Symptom Assessment
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-lg shadow-lg p-8 animate-slideIn">
          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="flex flex-col items-center text-center">
              <div className="text-3xl mb-3">🎤</div>
              <h3 className="font-semibold text-gray-900 mb-2">Voice Input</h3>
              <p className="text-sm text-gray-600">
                Describe your symptoms using voice
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="text-3xl mb-3">💬</div>
              <h3 className="font-semibold text-gray-900 mb-2">Chat</h3>
              <p className="text-sm text-gray-600">
                Natural conversation with AI assistant
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="text-3xl mb-3">📸</div>
              <h3 className="font-semibold text-gray-900 mb-2">Image Upload</h3>
              <p className="text-sm text-gray-600">
                Share photos of your gums/teeth
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="bg-teal-50 border-l-4 border-teal-500 p-4 mb-8 rounded">
            <p className="text-gray-700 text-sm leading-relaxed">
              PerioVoice AI helps you assess your periodontal symptoms through an interactive
              conversation. The AI will ask follow-up questions to understand your condition
              and provide an urgency recommendation. <strong>This is not a medical diagnosis</strong>
              - please consult a licensed dentist for proper evaluation.
            </p>
          </div>

          {/* Input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Enter Your Name or ID
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleStart()}
              placeholder="e.g., John Doe or user_123"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-teal-500 transition"
            />
          </div>

          {/* CTA Button */}
          <button
            onClick={handleStart}
            disabled={!userId.trim()}
            className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-gray-300 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105"
          >
            Start Assessment
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-600 text-sm">
          <p>
            PerioVoice AI™ - Final Year University Project | Version 1.0
          </p>
          <p className="mt-2">
            🔒 Your data is encrypted and secure
          </p>
        </div>
      </div>
    </div>
  )
}
