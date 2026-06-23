/**
 * API Service for PerioVoice AI
 * Handles all communication with the backend
 */

import axios from 'axios'

// Configure base URL using Vite environment variable support
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 30000,
})

/**
 * Start a new assessment session
 */
export const startAssessment = async (userId) => {
  try {
    const response = await api.post('/start', null, {
      params: { user_id: userId }
    })
    return response.data
  } catch (error) {
    console.error('Error starting assessment:', error)
    throw error
  }
}

/**
 * Send a chat message and get AI response
 */
export const sendMessage = async (sessionId, userId, message, inputType = 'text') => {
  try {
    const response = await api.post('/chat', {
      user_id: userId,
      message: message,
      input_type: inputType,
      session_id: sessionId
    })
    return response.data
  } catch (error) {
    console.error('Error sending message:', error)
    throw error
  }
}

/**
 * Upload and analyze a dental image
 */
export const uploadImage = async (file, sessionId = null) => {
  try {
    const formData = new FormData()
    formData.append('file', file)
    if (sessionId) {
      formData.append('session_id', sessionId)
    }

    const response = await api.post('/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  } catch (error) {
    console.error('Error uploading image:', error)
    throw error
  }
}

/**
 * Save a completed assessment
 */
export const saveAssessment = async (assessmentData) => {
  try {
    const response = await api.post('/save', assessmentData)
    return response.data
  } catch (error) {
    console.error('Error saving assessment:', error)
    throw error
  }
}

/**
 * Get assessment history for a user
 */
export const getHistory = async (userId) => {
  try {
    const response = await api.get('/history', {
      params: { user_id: userId }
    })
    return response.data
  } catch (error) {
    console.error('Error fetching history:', error)
    throw error
  }
}

export const getAssessmentPdf = async (assessmentId, userId) => {
  try {
    const response = await api.get(`/pdf/${assessmentId}`, {
      params: { user_id: userId }
    })
    return response.data
  } catch (error) {
    console.error('Error fetching PDF:', error)
    throw error
  }
}

/**
 * Health check
 */
export const healthCheck = async () => {
  try {
    const response = await axios.get(`${BACKEND_URL}/health`)
    return response.data
  } catch (error) {
    console.error('Backend health check failed:', error)
    throw error
  }
}

export default api
