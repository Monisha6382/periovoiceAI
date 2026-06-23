/**
 * Chat Page
 * Main assessment page with voice, text, and image input
 */

import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { VoiceButton } from '../components/VoiceButton'
import { ImageUpload } from '../components/ImageUpload'
import { ChatBubble } from '../components/ChatBubble'
import { startAssessment, sendMessage, uploadImage, saveAssessment } from '../utils/api'

export const Chat = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const userId = searchParams.get('userId') || 'user_unknown'

  // State management
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [userInput, setUserInput] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)
  const [inputMethod, setInputMethod] = useState('text') // 'text', 'voice', 'image'
  const messagesEndRef = useRef(null)

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      try {
        setIsLoading(true)
        const result = await startAssessment(userId)
        setSessionId(result.session_id)
        setMessages([
          {
            id: 1,
            text: result.greeting,
            isUser: false,
            timestamp: new Date(),
          },
          {
            id: 2,
            text: result.first_question,
            isUser: false,
            timestamp: new Date(),
          },
        ])
        setError(null)
      } catch (err) {
        setError('Failed to start assessment: ' + err.message)
      } finally {
        setIsLoading(false)
      }
    }

    initSession()
  }, [userId])

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle text message submission
  const handleSendMessage = async (messageText = null) => {
    const text = messageText || userInput
    if (!text.trim() || !sessionId) return

    // Add user message
    const userMsg = {
      id: messages.length + 1,
      text: text,
      isUser: true,
      timestamp: new Date(),
    }
    setMessages([...messages, userMsg])
    setUserInput('')

    // Get AI response
    try {
      setIsLoading(true)
      const response = await sendMessage(sessionId, userId, text, 'text')

      const aiMsg = {
        id: messages.length + 2,
        text: response.response,
        isUser: false,
        timestamp: new Date(),
      }
      const updatedMessages = [...messages, userMsg, aiMsg]
      setMessages(updatedMessages)

      // If assessment complete, save the assessment and navigate to the result page
      if (response.is_assessment_complete) {
        try {
          const assessmentData = {
            user_id: userId,
            session_id: sessionId,
            conversation_transcript: updatedMessages.map((msg) => ({
              isUser: msg.isUser,
              text: msg.text,
              timestamp: msg.timestamp.toISOString(),
            })),
            urgency_level: response.final_result?.urgency_level,
            risk_score: response.final_result?.risk_score,
            symptoms_found: response.final_result?.symptoms_found,
            recommendation: response.final_result?.recommendation,
            detected_from_image: response.final_result?.detected_from_image,
          }
          const saveResult = await saveAssessment(assessmentData)
          navigate('/result', {
            state: {
              result: response.final_result,
              pdfUrl: saveResult.pdf_url,
              assessmentId: saveResult.assessment_id,
              userId,
            },
          })
        } catch (saveError) {
          setError('Error saving assessment: ' + saveError.message)
          navigate('/result', {
            state: {
              result: response.final_result,
              pdfUrl: null,
              assessmentId: sessionId,
              userId,
            },
          })
        }
      }
    } catch (err) {
      setError('Error sending message: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle voice transcript
  const handleVoiceTranscript = (transcript) => {
    setUserInput(transcript)
    setInputMethod('text')
  }

  // Handle image upload
  const handleImageUpload = async (file) => {
    try {
      setIsLoading(true)
      const response = await uploadImage(file, sessionId)

      const imageMsg = {
        id: messages.length + 1,
        text: `📷 Image uploaded and analyzed:\n\n${response.image_description}`,
        isUser: false,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, imageMsg])
      setSelectedImage(null)
    } catch (err) {
      setError('Error uploading image: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading && messages.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <svg className="w-12 h-12 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-600">Starting your assessment...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">PerioVoice AI™</h1>
              <p className="text-sm text-gray-600">Assessment in progress</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="text-gray-600 hover:text-gray-900 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              message={msg.text}
              isUser={msg.isUser}
              timestamp={msg.timestamp}
            />
          ))}

          {isLoading && messages.length > 0 && (
            <div className="flex justify-start mb-4">
              <div className="bg-gray-200 rounded-lg rounded-bl-none px-4 py-3">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Tabs */}
          <div className="flex gap-2 mb-4 border-b border-gray-200">
            <button
              onClick={() => setInputMethod('text')}
              className={`px-4 py-2 font-semibold transition ${
                inputMethod === 'text'
                  ? 'text-teal-600 border-b-2 border-teal-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              💬 Text
            </button>
            <button
              onClick={() => setInputMethod('voice')}
              className={`px-4 py-2 font-semibold transition ${
                inputMethod === 'voice'
                  ? 'text-teal-600 border-b-2 border-teal-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🎤 Voice
            </button>
            <button
              onClick={() => setInputMethod('image')}
              className={`px-4 py-2 font-semibold transition ${
                inputMethod === 'image'
                  ? 'text-teal-600 border-b-2 border-teal-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📸 Image
            </button>
          </div>

          {/* Text Input */}
          {inputMethod === 'text' && (
            <div className="flex gap-2">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type your response..."
                disabled={isLoading}
                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-teal-500 disabled:bg-gray-100 transition"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={isLoading || !userInput.trim()}
                className="bg-teal-500 hover:bg-teal-600 disabled:bg-gray-300 text-white font-bold px-6 py-3 rounded-lg transition"
              >
                Send
              </button>
            </div>
          )}

          {/* Voice Input */}
          {inputMethod === 'voice' && (
            <VoiceButton
              onTranscriptReady={handleVoiceTranscript}
              onError={setError}
            />
          )}

          {/* Image Input */}
          {inputMethod === 'image' && (
            <div className="space-y-4">
              <ImageUpload
                onImageSelected={handleImageUpload}
                onError={setError}
                isLoading={isLoading}
              />
              {selectedImage && (
                <button
                  onClick={() => setInputMethod('text')}
                  className="text-sm text-teal-600 hover:text-teal-700"
                >
                  Continue with text...
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
