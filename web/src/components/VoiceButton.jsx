/**
 * VoiceButton Component
 * Handles voice input using Web Speech API
 */

import React from 'react'
import { useVoiceRecognition } from '../hooks/useVoiceRecognition'

export const VoiceButton = ({ onTranscriptReady, onError }) => {
  const { isListening, transcript, error, startListening, stopListening, resetTranscript } =
    useVoiceRecognition()

  const handleStartRecording = () => {
    resetTranscript()
    startListening()
  }

  const handleStopRecording = () => {
    stopListening()
    if (transcript.trim()) {
      onTranscriptReady(transcript.trim())
    }
  }

  React.useEffect(() => {
    if (error) {
      onError(error)
    }
  }, [error, onError])

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={isListening ? handleStopRecording : handleStartRecording}
        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
          isListening
            ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
            : 'bg-teal-500 hover:bg-teal-600 text-white'
        }`}
      >
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          {isListening ? (
            <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V4z" />
          ) : (
            <path d="M9.172 16.172a4 4 0 015.656 0M9 10a4 4 0 018 0m-8-4a6 6 0 0112 0" />
          )}
        </svg>
        {isListening ? 'Stop Recording' : 'Start Recording'}
      </button>

      {transcript && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
          <p className="text-sm text-gray-700">
            <strong>Transcript:</strong> {transcript}
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  )
}
