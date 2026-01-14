'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Car, MapPin, Clock, Navigation, QrCode, Search } from 'lucide-react'

interface CarLocation {
  found: boolean
  token?: {
    id: string
    tokenNumber: string
    entryTime: string
    licensePlate?: string
  }
  slot?: {
    id: string
    slotNumber: string
    zone: {
      name: string
      code: string
      level: number
    }
  }
  parkingLot?: {
    name: string
    address?: string
  }
  directions?: {
    steps: string[]
    estimatedWalkTime: number
  }
}

function FindMyCarContent() {
  const searchParams = useSearchParams()
  const initialToken = searchParams.get('token') || ''
  const initialPlate = searchParams.get('plate') || ''

  const [searchType, setSearchType] = useState<'token' | 'plate'>('token')
  const [searchValue, setSearchValue] = useState(initialToken || initialPlate)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CarLocation | null>(null)

  // Auto-search if params are provided
  useEffect(() => {
    if (initialToken || initialPlate) {
      setSearchType(initialToken ? 'token' : 'plate')
      setSearchValue(initialToken || initialPlate)
    }
  }, [initialToken, initialPlate])

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      setError('Please enter a token number or license plate')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const params = new URLSearchParams({
        [searchType]: searchValue.trim().toUpperCase()
      })

      const response = await fetch(`/api/find-car?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to find vehicle')
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const getFloorLabel = (level: number) => {
    if (level === 0) return 'Ground Floor'
    if (level > 0) return `Floor ${level}`
    return `Basement ${Math.abs(level)}`
  }

  const formatDuration = (entryTime: string) => {
    const entry = new Date(entryTime)
    const now = new Date()
    const diffMs = now.getTime() - entry.getTime()
    const hours = Math.floor(diffMs / 3600000)
    const minutes = Math.floor((diffMs % 3600000) / 60000)

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white p-4">
      <div className="max-w-lg mx-auto pt-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 mb-4">
            <Car className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold">Find My Car</h1>
          <p className="text-gray-400 mt-2">
            Enter your token number or license plate to locate your vehicle
          </p>
        </div>

        {/* Search Card */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Search for Your Vehicle</CardTitle>
            <CardDescription>
              Use either your parking token or license plate number
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search Type Toggle */}
            <div className="flex rounded-lg bg-gray-900 p-1">
              <button
                onClick={() => setSearchType('token')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-all ${
                  searchType === 'token'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <QrCode className="w-4 h-4" />
                Token Number
              </button>
              <button
                onClick={() => setSearchType('plate')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-all ${
                  searchType === 'plate'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Car className="w-4 h-4" />
                License Plate
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Input
                placeholder={searchType === 'token' ? 'Enter token (e.g., TKN-12345)' : 'Enter plate (e.g., MH12AB1234)'}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="bg-gray-900 border-gray-700 text-white text-lg py-6 pr-12"
              />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            </div>

            {/* Search Button */}
            <Button
              onClick={handleSearch}
              disabled={loading}
              className="w-full py-6 text-lg bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5 mr-2" />
                  Find My Car
                </>
              )}
            </Button>

            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-lg bg-red-900/30 border border-red-500/50 text-red-400">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Result Card */}
        {result && (
          <Card className="mt-6 bg-gray-800 border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">
                  {result.found ? 'Vehicle Found!' : 'Vehicle Not Found'}
                </CardTitle>
                {result.found && (
                  <Badge className="bg-green-600">Active</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {result.found && result.slot && result.token ? (
                <div className="space-y-6">
                  {/* Location Highlight */}
                  <div className="p-6 rounded-xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30">
                    <div className="text-center">
                      <div className="text-sm text-gray-400 mb-1">Your vehicle is at</div>
                      <div className="text-5xl font-bold text-white mb-2">
                        {result.slot.slotNumber}
                      </div>
                      <div className="text-xl text-blue-400">
                        {result.slot.zone.name} ({result.slot.zone.code})
                      </div>
                      <div className="text-gray-400 mt-1">
                        {getFloorLabel(result.slot.zone.level)}
                      </div>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-gray-900">
                      <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                        <QrCode className="w-4 h-4" />
                        Token
                      </div>
                      <div className="text-lg font-semibold text-white">
                        {result.token.tokenNumber}
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-gray-900">
                      <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                        <Clock className="w-4 h-4" />
                        Duration
                      </div>
                      <div className="text-lg font-semibold text-white">
                        {formatDuration(result.token.entryTime)}
                      </div>
                    </div>

                    {result.token.licensePlate && (
                      <div className="p-4 rounded-lg bg-gray-900 col-span-2">
                        <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                          <Car className="w-4 h-4" />
                          License Plate
                        </div>
                        <div className="text-lg font-semibold text-white">
                          {result.token.licensePlate}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Directions */}
                  {result.directions && (
                    <div className="p-4 rounded-lg bg-gray-900">
                      <div className="flex items-center gap-2 text-gray-400 mb-3">
                        <Navigation className="w-4 h-4" />
                        <span>Directions to your car</span>
                        <Badge variant="outline" className="ml-auto">
                          ~{result.directions.estimatedWalkTime} min walk
                        </Badge>
                      </div>
                      <ol className="space-y-2">
                        {result.directions.steps.map((step, index) => (
                          <li key={index} className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center">
                              {index + 1}
                            </span>
                            <span className="text-gray-300">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Parking Lot Info */}
                  {result.parkingLot && (
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-gray-900/50">
                      <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium text-white">{result.parkingLot.name}</div>
                        {result.parkingLot.address && (
                          <div className="text-sm text-gray-400">{result.parkingLot.address}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Car className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">
                    No active parking session found for this {searchType === 'token' ? 'token' : 'license plate'}.
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Please check the {searchType === 'token' ? 'token number' : 'license plate'} and try again.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Help Text */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Having trouble? Ask our staff for assistance.</p>
          <p className="mt-1">Token number is printed on your parking ticket.</p>
        </div>
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white p-4 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-500" />
        <p className="text-gray-400">Loading...</p>
      </div>
    </div>
  )
}

export default function FindMyCarPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <FindMyCarContent />
    </Suspense>
  )
}
