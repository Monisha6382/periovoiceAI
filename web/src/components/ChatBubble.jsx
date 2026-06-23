/**
 * ChatBubble Component
 * Displays individual chat messages
 */

import React from 'react'

export const ChatBubble = ({ message, isUser = false, timestamp = null }) => {
  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-slideIn`}
    >
      <div
        className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
          isUser
            ? 'bg-teal-500 text-white rounded-br-none'
            : 'bg-gray-200 text-gray-800 rounded-bl-none'
        }`}
      >
        <p className="text-sm break-words whitespace-pre-wrap">{message}</p>
        {formattedTime && (
          <p
            className={`text-xs mt-1 ${
              isUser ? 'text-teal-100' : 'text-gray-500'
            }`}
          >
            {formattedTime}
          </p>
        )}
      </div>
    </div>
  )
}
