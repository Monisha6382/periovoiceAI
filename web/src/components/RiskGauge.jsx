/**
 * RiskGauge Component
 * Visual representation of risk score (1-10)
 */

import React from 'react'

export const RiskGauge = ({ score = 5, size = 'md' }) => {
  const sizeConfig = {
    sm: { outer: 60, inner: 50, text: 'text-lg' },
    md: { outer: 120, inner: 100, text: 'text-4xl' },
    lg: { outer: 160, inner: 140, text: 'text-5xl' },
  }

  const config = sizeConfig[size] || sizeConfig.md

  // Determine color based on score
  let color = '#4CAF50' // Low (1-3)
  if (score > 3 && score <= 6) color = '#FFC107' // Moderate (4-6)
  if (score > 6 && score <= 8) color = '#F44336' // High (7-8)
  if (score > 8) color = '#9C27B0' // Emergency (9-10)

  // Calculate the angle for the needle (0-180 degrees, with 0 at left)
  const angle = (score / 10) * 180 - 90

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: config.outer, height: config.outer }}>
        {/* Gauge background */}
        <svg
          width={config.outer}
          height={config.outer}
          viewBox={`0 0 ${config.outer} ${config.outer}`}
          className="w-full h-full"
        >
          {/* Low risk section (green) */}
          <path
            d={`M ${config.outer / 2} ${config.outer / 2} L ${config.outer * 0.75} ${config.outer * 0.25} A ${config.outer / 2} ${config.outer / 2} 0 0 1 ${config.outer * 0.85} ${config.outer * 0.5}`}
            fill="none"
            stroke="#4CAF50"
            strokeWidth="8"
            opacity="0.3"
          />
          {/* Moderate risk section (yellow) */}
          <path
            d={`M ${config.outer * 0.85} ${config.outer * 0.5} A ${config.outer / 2} ${config.outer / 2} 0 0 1 ${config.outer * 0.75} ${config.outer * 0.75}`}
            fill="none"
            stroke="#FFC107"
            strokeWidth="8"
            opacity="0.3"
          />
          {/* High risk section (red) */}
          <path
            d={`M ${config.outer * 0.75} ${config.outer * 0.75} A ${config.outer / 2} ${config.outer / 2} 0 0 1 ${config.outer * 0.25} ${config.outer * 0.75}`}
            fill="none"
            stroke="#F44336"
            strokeWidth="8"
            opacity="0.3"
          />
          {/* Emergency section (purple) */}
          <path
            d={`M ${config.outer * 0.25} ${config.outer * 0.75} A ${config.outer / 2} ${config.outer / 2} 0 0 1 ${config.outer * 0.15} ${config.outer * 0.5}`}
            fill="none"
            stroke="#9C27B0"
            strokeWidth="8"
            opacity="0.3"
          />

          {/* Scale markers */}
          {[0, 2, 4, 6, 8, 10].map((num) => {
            const markAngle = (num / 10) * 180 - 90
            const rad = (markAngle * Math.PI) / 180
            const x1 = config.outer / 2 + Math.cos(rad) * (config.outer / 2 - 5)
            const y1 = config.outer / 2 + Math.sin(rad) * (config.outer / 2 - 5)
            const x2 = config.outer / 2 + Math.cos(rad) * (config.outer / 2 - 15)
            const y2 = config.outer / 2 + Math.sin(rad) * (config.outer / 2 - 15)
            return (
              <line
                key={num}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#666"
                strokeWidth="2"
              />
            )
          })}
        </svg>

        {/* Center circle with score */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: `radial-gradient(circle, white 0%, #f5f5f5 100%)`,
            borderRadius: '50%',
            width: `${config.inner}px`,
            height: `${config.inner}px`,
            left: `${(config.outer - config.inner) / 2}px`,
            top: `${(config.outer - config.inner) / 2}px`,
          }}
        >
          <div className="text-center">
            <div className={`${config.text} font-bold`} style={{ color }}>
              {score}
            </div>
            <div className="text-xs text-gray-600">/10</div>
          </div>
        </div>

        {/* Needle */}
        <div
          className="absolute w-1 bg-gray-800 rounded-full"
          style={{
            height: `${config.outer / 2 - 15}px`,
            left: `${config.outer / 2 - 2}px`,
            top: `${config.outer / 2 - (config.outer / 2 - 15)}px`,
            transformOrigin: 'center bottom',
            transform: `rotate(${angle}deg)`,
            transition: 'transform 0.5s ease-out',
          }}
        />
      </div>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap justify-center text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span>Low (1-3)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span>Moderate (4-6)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span>High (7-8)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-purple-600"></div>
          <span>Emergency (9-10)</span>
        </div>
      </div>
    </div>
  )
}
