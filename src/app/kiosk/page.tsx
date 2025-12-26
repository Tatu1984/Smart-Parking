'use client'

import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils/currency'

interface ParkingLotStatus {
  id: string
  name: string
  address: string
  totalSlots: number
  availableSlots: number
  occupiedSlots: number
  zones: {
    id: string
    name: string
    type: string
    total: number
    available: number
    hourlyRate: number
  }[]
  pricing: {
    type: string
    rate: number
    unit: string
  }[]
}

interface RecentEntry {
  tokenNumber: string
  vehicleNumber?: string
  entryTime: string
  zone: string
}

export default function KioskPage() {
  const [status, setStatus] = useState<ParkingLotStatus | null>(null)
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Update time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timeInterval)
  }, [])

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const lotId = params.get('lot')

        if (!lotId) {
          setError('No parking lot specified. Add ?lot=YOUR_LOT_ID to the URL.')
          setLoading(false)
          return
        }

        const response = await fetch(`/api/parking-lots/${lotId}/status`)
        if (!response.ok) throw new Error('Failed to fetch status')

        const data = await response.json()
        if (data.success) {
          setStatus(data.data)
          setRecentEntries(data.data.recentEntries || [])
        }
        setLoading(false)
      } catch (err) {
        setError('Failed to load parking status')
        setLoading(false)
      }
    }

    fetchStatus()
    const statusInterval = setInterval(fetchStatus, 30000) // Refresh every 30 seconds

    return () => clearInterval(statusInterval)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="animate-pulse text-white text-4xl">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-4xl mb-4">Error</div>
          <div className="text-white text-xl">{error}</div>
        </div>
      </div>
    )
  }

  if (!status) return null

  const occupancyPercent = Math.round((status.occupiedSlots / status.totalSlots) * 100)
  const occupancyColor =
    occupancyPercent >= 90
      ? 'text-red-500'
      : occupancyPercent >= 70
        ? 'text-yellow-500'
        : 'text-green-500'

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-8">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold">{status.name}</h1>
          <p className="text-gray-400 text-xl">{status.address}</p>
        </div>
        <div className="text-right">
          <div className="text-5xl font-mono">
            {currentTime.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </div>
          <div className="text-gray-400 text-xl">
            {currentTime.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Availability Overview */}
        <div className="col-span-4 bg-gray-800/50 rounded-2xl p-6 backdrop-blur">
          <h2 className="text-2xl font-semibold mb-6">Availability</h2>
          <div className="flex flex-col items-center">
            <div className="relative">
              <svg className="w-48 h-48" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#374151"
                  strokeWidth="10"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke={
                    occupancyPercent >= 90
                      ? '#ef4444'
                      : occupancyPercent >= 70
                        ? '#eab308'
                        : '#22c55e'
                  }
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${occupancyPercent * 2.83} 283`}
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-5xl font-bold ${occupancyColor}`}>
                  {status.availableSlots}
                </span>
                <span className="text-gray-400">Available</span>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-blue-400">{status.totalSlots}</div>
                <div className="text-gray-400">Total Slots</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-orange-400">{status.occupiedSlots}</div>
                <div className="text-gray-400">Occupied</div>
              </div>
            </div>
          </div>
        </div>

        {/* Zone Status */}
        <div className="col-span-5 bg-gray-800/50 rounded-2xl p-6 backdrop-blur">
          <h2 className="text-2xl font-semibold mb-6">Zones</h2>
          <div className="space-y-4">
            {status.zones.map((zone) => {
              const zonePercent = Math.round(((zone.total - zone.available) / zone.total) * 100)
              return (
                <div key={zone.id} className="bg-gray-700/50 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <span className="font-semibold text-xl">{zone.name}</span>
                      <span className="text-gray-400 ml-2 text-sm">({zone.type})</span>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-2xl font-bold ${zone.available > 0 ? 'text-green-400' : 'text-red-400'}`}
                      >
                        {zone.available}
                      </span>
                      <span className="text-gray-400">/{zone.total}</span>
                    </div>
                  </div>
                  <div className="h-3 bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        zonePercent >= 90
                          ? 'bg-red-500'
                          : zonePercent >= 70
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                      }`}
                      style={{ width: `${zonePercent}%` }}
                    />
                  </div>
                  <div className="mt-2 text-sm text-gray-400">
                    Rate: {formatCurrency(zone.hourlyRate / 100, 'INR')}/hr
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pricing & Info */}
        <div className="col-span-3 space-y-6">
          {/* Pricing */}
          <div className="bg-gray-800/50 rounded-2xl p-6 backdrop-blur">
            <h2 className="text-2xl font-semibold mb-4">Rates</h2>
            <div className="space-y-3">
              {status.pricing.map((price, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-gray-300">{price.type}</span>
                  <span className="font-semibold text-green-400">
                    {formatCurrency(price.rate / 100, 'INR')}/{price.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Entries */}
          <div className="bg-gray-800/50 rounded-2xl p-6 backdrop-blur">
            <h2 className="text-2xl font-semibold mb-4">Recent Entries</h2>
            <div className="space-y-2">
              {recentEntries.slice(0, 5).map((entry, index) => (
                <div key={index} className="bg-gray-700/50 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-semibold">{entry.tokenNumber}</span>
                    <span className="text-xs text-gray-400">{entry.zone}</span>
                  </div>
                  {entry.vehicleNumber && (
                    <div className="text-sm text-gray-400">{entry.vehicleNumber}</div>
                  )}
                </div>
              ))}
              {recentEntries.length === 0 && (
                <div className="text-gray-400 text-center py-4">No recent entries</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-8 flex justify-between items-center text-gray-500">
        <div>Powered by SParking</div>
        <div>Last updated: {new Date().toLocaleTimeString()}</div>
      </footer>
    </div>
  )
}
