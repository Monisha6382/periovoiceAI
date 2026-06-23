/**
 * UrgencyBadge Component
 * Displays the urgency level with appropriate color and icon
 */

import React from 'react'

const urgencyConfig = {
  LOW: {
    color: 'bg-green-500',
    textColor: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-500',
    icon: '🟢',
    label: 'LOW RISK',
    description: 'Home care is sufficient',
  },
  MODERATE: {
    color: 'bg-yellow-500',
    textColor: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-500',
    icon: '🟡',
    label: 'MODERATE',
    description: 'See dentist within 1-2 weeks',
  },
  HIGH: {
    color: 'bg-red-500',
    textColor: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
    icon: '🔴',
    label: 'HIGH URGENCY',
    description: 'See dentist within 48 hours',
  },
  EMERGENCY: {
    color: 'bg-purple-600',
    textColor: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-600',
    icon: '🚨',
    label: 'EMERGENCY',
    description: 'Seek immediate dental care',
  },
}

export const UrgencyBadge = ({ level = 'LOW', riskScore = 1 }) => {
  const config = urgencyConfig[level] || urgencyConfig.LOW

  return (
    <div
      className={`${config.bgColor} border-l-4 ${config.borderColor} p-4 rounded-lg animate-slideIn`}
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl">{config.icon}</span>
        <div className="flex-1">
          <h3 className={`${config.textColor} font-bold text-lg`}>
            {config.label}
          </h3>
          <p className={`${config.textColor} text-sm opacity-90`}>
            {config.description}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="text-sm font-semibold text-gray-700">
              Risk Score: <span className={config.color + ' text-white px-2 py-1 rounded'}>{riskScore}/10</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
