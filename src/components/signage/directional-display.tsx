'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

// ============================================
// TYPES
// ============================================

export interface ZoneAvailability {
  id: string
  name: string
  code: string
  level: number
  available: number
  total: number
  direction?: 'LEFT' | 'RIGHT' | 'STRAIGHT' | 'UP' | 'DOWN'
  distance?: string
}

export interface DirectionalDisplayProps {
  parkingLotId: string
  parkingLotName: string
  zones: ZoneAvailability[]
  refreshInterval?: number
  theme?: 'light' | 'dark'
  showArrows?: boolean
  showFloorInfo?: boolean
}

// ============================================
// ARROW COMPONENTS
// ============================================

const ArrowLeft = ({ className }: { className?: string }) => (
  <svg className={cn("w-16 h-16", className)} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
  </svg>
)

const ArrowRight = ({ className }: { className?: string }) => (
  <svg className={cn("w-16 h-16", className)} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
  </svg>
)

const ArrowUp = ({ className }: { className?: string }) => (
  <svg className={cn("w-16 h-16", className)} viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8z" />
  </svg>
)

const ArrowDown = ({ className }: { className?: string }) => (
  <svg className={cn("w-16 h-16", className)} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8z" />
  </svg>
)

const ArrowStraight = ({ className }: { className?: string }) => (
  <svg className={cn("w-16 h-16", className)} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 4l-1.41 1.41L11 5.83V20h2V5.83l.41-.42L12 4z" />
    <path d="M7 9l5-5 5 5H7z" />
  </svg>
)

function DirectionArrow({
  direction,
  className
}: {
  direction?: 'LEFT' | 'RIGHT' | 'STRAIGHT' | 'UP' | 'DOWN'
  className?: string
}) {
  switch (direction) {
    case 'LEFT':
      return <ArrowLeft className={className} />
    case 'RIGHT':
      return <ArrowRight className={className} />
    case 'UP':
      return <ArrowUp className={className} />
    case 'DOWN':
      return <ArrowDown className={className} />
    case 'STRAIGHT':
    default:
      return <ArrowStraight className={className} />
  }
}

// ============================================
// AVAILABILITY INDICATOR
// ============================================

function AvailabilityIndicator({ available, total }: { available: number; total: number }) {
  const percentage = total > 0 ? (available / total) * 100 : 0

  let statusColor = 'bg-green-500'
  let statusText = 'AVAILABLE'

  if (percentage === 0) {
    statusColor = 'bg-red-500'
    statusText = 'FULL'
  } else if (percentage < 20) {
    statusColor = 'bg-orange-500'
    statusText = 'LIMITED'
  } else if (percentage < 50) {
    statusColor = 'bg-yellow-500'
    statusText = 'MODERATE'
  }

  return (
    <div className="flex flex-col items-center">
      <div className={cn(
        "text-6xl font-bold tabular-nums",
        percentage === 0 ? "text-red-500" :
        percentage < 20 ? "text-orange-500" :
        percentage < 50 ? "text-yellow-500" : "text-green-500"
      )}>
        {available}
      </div>
      <div className="text-xl text-gray-400">/ {total}</div>
      <div className={cn(
        "mt-2 px-3 py-1 rounded-full text-sm font-semibold text-white",
        statusColor
      )}>
        {statusText}
      </div>
    </div>
  )
}

// ============================================
// ZONE DIRECTION CARD
// ============================================

function ZoneDirectionCard({ zone, showArrow = true }: { zone: ZoneAvailability; showArrow?: boolean }) {
  const percentage = zone.total > 0 ? (zone.available / zone.total) * 100 : 0
  const isFull = percentage === 0

  return (
    <div className={cn(
      "flex items-center justify-between p-6 rounded-2xl",
      "transition-all duration-300",
      isFull ? "bg-red-900/30 border border-red-500/50" : "bg-gray-800/50 border border-gray-700"
    )}>
      {/* Arrow */}
      {showArrow && zone.direction && (
        <div className={cn(
          "flex-shrink-0 mr-6",
          isFull ? "text-red-400" : "text-green-400 animate-pulse"
        )}>
          <DirectionArrow direction={zone.direction} />
        </div>
      )}

      {/* Zone Info */}
      <div className="flex-grow">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-white">{zone.name}</span>
          <span className="text-xl text-gray-400">{zone.code}</span>
        </div>
        {zone.level !== 0 && (
          <div className="text-lg text-gray-500">
            {zone.level > 0 ? `Floor ${zone.level}` : `Basement ${Math.abs(zone.level)}`}
          </div>
        )}
        {zone.distance && (
          <div className="text-sm text-gray-500 mt-1">{zone.distance}</div>
        )}
      </div>

      {/* Availability */}
      <div className="flex-shrink-0 ml-6">
        <AvailabilityIndicator available={zone.available} total={zone.total} />
      </div>
    </div>
  )
}

// ============================================
// FLOOR SUMMARY
// ============================================

function FloorSummary({ zones }: { zones: ZoneAvailability[] }) {
  // Group by level
  const floors = new Map<number, { available: number; total: number }>()

  for (const zone of zones) {
    const floor = floors.get(zone.level) || { available: 0, total: 0 }
    floor.available += zone.available
    floor.total += zone.total
    floors.set(zone.level, floor)
  }

  const sortedFloors = Array.from(floors.entries()).sort((a, b) => b[0] - a[0])

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {sortedFloors.map(([level, data]) => {
        const percentage = data.total > 0 ? (data.available / data.total) * 100 : 0
        const levelName = level === 0 ? 'Ground' : level > 0 ? `Floor ${level}` : `B${Math.abs(level)}`

        return (
          <div
            key={level}
            className={cn(
              "p-4 rounded-xl text-center",
              percentage === 0 ? "bg-red-900/30" :
              percentage < 30 ? "bg-orange-900/30" :
              "bg-gray-800/50"
            )}
          >
            <div className="text-lg text-gray-400">{levelName}</div>
            <div className={cn(
              "text-4xl font-bold",
              percentage === 0 ? "text-red-400" :
              percentage < 30 ? "text-orange-400" :
              "text-green-400"
            )}>
              {data.available}
            </div>
            <div className="text-sm text-gray-500">of {data.total}</div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export function DirectionalDisplay({
  parkingLotName,
  zones,
  refreshInterval = 30000,
  theme = 'dark',
  showArrows = true,
  showFloorInfo = true
}: DirectionalDisplayProps) {
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Calculate totals
  const totalAvailable = zones.reduce((sum, z) => sum + z.available, 0)
  const totalSlots = zones.reduce((sum, z) => sum + z.total, 0)
  const overallPercentage = totalSlots > 0 ? (totalAvailable / totalSlots) * 100 : 0

  // Sort zones by availability (most available first)
  const sortedZones = [...zones].sort((a, b) => {
    // Show zones with availability first
    if (a.available > 0 && b.available === 0) return -1
    if (a.available === 0 && b.available > 0) return 1
    // Then by percentage available
    const aPercent = a.total > 0 ? a.available / a.total : 0
    const bPercent = b.total > 0 ? b.available / b.total : 0
    return bPercent - aPercent
  })

  return (
    <div className={cn(
      "min-h-screen p-8",
      theme === 'dark' ? "bg-gray-950 text-white" : "bg-gray-100 text-gray-900"
    )}>
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-4xl font-bold">{parkingLotName}</h1>
          <p className="text-xl text-gray-400 mt-1">Parking Availability</p>
        </div>
        <div className="text-right">
          <div className="text-5xl font-mono tabular-nums">
            {currentTime.toLocaleTimeString('en-US', { hour12: false })}
          </div>
          <div className="text-lg text-gray-400">
            {currentTime.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric'
            })}
          </div>
        </div>
      </div>

      {/* Overall Availability */}
      <div className={cn(
        "p-8 rounded-3xl mb-8",
        overallPercentage === 0 ? "bg-red-900/30 border-2 border-red-500" :
        overallPercentage < 20 ? "bg-orange-900/30 border-2 border-orange-500" :
        "bg-gray-800/50 border border-gray-700"
      )}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl text-gray-400">Total Available Spaces</h2>
            <div className="flex items-baseline gap-4 mt-2">
              <span className={cn(
                "text-8xl font-bold tabular-nums",
                overallPercentage === 0 ? "text-red-400" :
                overallPercentage < 20 ? "text-orange-400" :
                "text-green-400"
              )}>
                {totalAvailable}
              </span>
              <span className="text-3xl text-gray-500">/ {totalSlots}</span>
            </div>
          </div>

          {/* Progress Ring */}
          <div className="relative w-32 h-32">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="12"
                fill="none"
                className="text-gray-700"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="12"
                fill="none"
                strokeDasharray={`${overallPercentage * 3.52} 352`}
                className={cn(
                  "transition-all duration-1000",
                  overallPercentage === 0 ? "text-red-500" :
                  overallPercentage < 20 ? "text-orange-500" :
                  overallPercentage < 50 ? "text-yellow-500" :
                  "text-green-500"
                )}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold">{Math.round(overallPercentage)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floor Summary */}
      {showFloorInfo && (
        <div className="mb-8">
          <h3 className="text-xl text-gray-400 mb-4">Floor Overview</h3>
          <FloorSummary zones={zones} />
        </div>
      )}

      {/* Zone Directions */}
      <div className="space-y-4">
        <h3 className="text-xl text-gray-400 mb-4">Zone Directions</h3>
        {sortedZones.map(zone => (
          <ZoneDirectionCard
            key={zone.id}
            zone={zone}
            showArrow={showArrows}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-gray-800 text-center text-gray-500">
        <p>Auto-refreshes every {refreshInterval / 1000} seconds</p>
        <p className="text-sm mt-1">Powered by Sparking AI</p>
      </div>
    </div>
  )
}

export default DirectionalDisplay
