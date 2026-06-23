/**
 * Custom hook for Web Speech API integration
 * Handles voice recording and transcription
 */

import { useState, useRef, useCallback } from 'react'

export const useVoiceRecognition = () => {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState(null)
  const recognitionRef = useRef(null)

  // Check browser support
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

  if (!SpeechRecognition) {
    console.warn('Speech Recognition not supported in this browser')
  }

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setError('Speech Recognition not supported in your browser')
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognitionRef.current = recognition

      // Configuration
      recognition.continuous = true
      recognition.interimResults = true
      recognition.language = 'en-US'

      let interimTranscript = ''

      // When speech is recognized
      recognition.onstart = () => {
        setIsListening(true)
        setError(null)
      }

      recognition.onresult = (event) => {
        interimTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript

          if (event.results[i].isFinal) {
            setTranscript((prev) => prev + transcript + ' ')
          } else {
            interimTranscript += transcript
          }
        }
      }

      recognition.onerror = (event) => {
        setError(`Speech recognition error: ${event.error}`)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognition.start()
    } catch (err) {
      setError(`Error starting voice recognition: ${err.message}`)
      setIsListening(false)
    }
  }, [SpeechRecognition])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }, [])

  const resetTranscript = useCallback(() => {
    setTranscript('')
    setError(null)
  }, [])

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  }
}
