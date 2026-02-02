'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search,
  Upload,
  X,
  Image as ImageIcon,
  Car,
  Clock,
  Camera as CameraIcon,
  AlertCircle,
  CheckCircle2,
  Ban,
  Crown,
} from 'lucide-react'

interface SearchResult {
  id: string
  score: number
  camera_id: string
  vehicle_type: string | null
  vehicle_color: string | null
  license_plate: string | null
  detected_at: number
  confidence: number
  image_url: string
  sparking: {
    vehicle: {
      id: string
      licensePlate: string
      vehicleType: string
      make: string | null
      model: string | null
      color: string | null
      isBlacklisted: boolean
      isVip: boolean
    } | null
    token: {
      id: string
      tokenNumber: string
      entryTime: string
      status: string
    } | null
    camera: {
      id: string
      name: string
      parkingLot: {
        id: string
        name: string
      }
    } | null
  } | null
}

interface ImageSearchProps {
  cameras?: Array<{ id: string; name: string }>
  onResultSelect?: (result: SearchResult) => void
  className?: string
}

export function ImageSearch({
  cameras = [],
  onResultSelect,
  className = '',
}: ImageSearchProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [queryTime, setQueryTime] = useState<number | null>(null)

  // Search parameters
  const [limit, setLimit] = useState(10)
  const [minConfidence, setMinConfidence] = useState(0)
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // AbortController for cancelling in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null)

  // Maximum file size: 10MB
  const MAX_FILE_SIZE = 10 * 1024 * 1024

  // Cleanup object URLs and abort pending requests on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      abortControllerRef.current?.abort()
    }
  }, [previewUrl])

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('Image file is too large. Maximum size is 10MB.')
      return
    }

    // Revoke previous URL to prevent memory leak
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    setSelectedImage(file)
    setPreviewUrl(URL.createObjectURL(file))
    setError(null)
    setResults([])
    setHasSearched(false)
  }, [previewUrl, MAX_FILE_SIZE])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) {
        handleFileSelect(file)
      }
    },
    [handleFileSelect]
  )

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    // Only set isDragOver to false if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const clearSelection = () => {
    setSelectedImage(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    setResults([])
    setError(null)
    setQueryTime(null)
    setHasSearched(false)
    // Cancel any in-flight request
    abortControllerRef.current?.abort()
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const performSearch = async () => {
    if (!selectedImage) return

    // Cancel any previous request
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()

    setIsSearching(true)
    setError(null)
    setResults([])
    setHasSearched(true)

    try {
      const formData = new FormData()
      formData.append('image', selectedImage)
      formData.append('limit', limit.toString())
      formData.append('minConfidence', minConfidence.toString())
      if (selectedCameraId) {
        formData.append('cameraIds', selectedCameraId)
      }

      const response = await fetch('/api/vehicles/search', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Search failed')
      }

      const data = await response.json()
      setResults(data.data.matches)
      setQueryTime(data.data.queryTimeMs)
    } catch (err) {
      // Don't show error if request was aborted
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setIsSearching(false)
    }
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  const getScoreColor = (score: number) => {
    if (score >= 0.9) return 'bg-green-500'
    if (score >= 0.7) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" aria-hidden="true" />
            Vehicle Image Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drop Zone - Accessible */}
          <div
            role="button"
            tabIndex={0}
            aria-label={previewUrl ? 'Vehicle image selected. Press Enter to change or Delete to remove.' : 'Drop zone for vehicle image. Press Enter to select an image file.'}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              } else if ((e.key === 'Delete' || e.key === 'Backspace') && previewUrl) {
                e.preventDefault()
                clearSelection()
              }
            }}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
              isDragOver
                ? 'border-primary bg-primary/5'
                : previewUrl
                  ? 'border-primary'
                  : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            {previewUrl ? (
              <div className="relative inline-block">
                <img
                  src={previewUrl}
                  alt="Selected vehicle image for search"
                  className="max-h-48 rounded-lg mx-auto"
                />
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute -top-2 -right-2"
                  onClick={clearSelection}
                  aria-label="Remove selected image"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-12 h-12 mx-auto text-gray-400" aria-hidden="true" />
                <p className="text-gray-600" id="dropzone-description">
                  Drag and drop an image here, or click to select
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInputChange}
                  className="sr-only"
                  aria-describedby="dropzone-description"
                  aria-label="Select vehicle image file"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Select image file"
                >
                  <ImageIcon className="w-4 h-4 mr-2" aria-hidden="true" />
                  Select Image
                </Button>
              </div>
            )}
          </div>

          {/* Search Parameters */}
          <fieldset className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <legend className="sr-only">Search Parameters</legend>
            <div className="space-y-2">
              <Label htmlFor="results-limit">Results Limit</Label>
              <Select
                value={limit.toString()}
                onValueChange={(v) => setLimit(parseInt(v, 10))}
              >
                <SelectTrigger id="results-limit" aria-label="Select number of results">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 results</SelectItem>
                  <SelectItem value="10">10 results</SelectItem>
                  <SelectItem value="20">20 results</SelectItem>
                  <SelectItem value="50">50 results</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="min-confidence" id="confidence-label">
                Min Confidence: {minConfidence.toFixed(2)}
              </Label>
              <Slider
                id="min-confidence"
                value={[minConfidence]}
                onValueChange={(v) => setMinConfidence(v[0])}
                min={0}
                max={1}
                step={0.05}
                aria-labelledby="confidence-label"
                aria-valuemin={0}
                aria-valuemax={1}
                aria-valuenow={minConfidence}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="camera-filter">Filter by Camera</Label>
              <Select
                value={selectedCameraId}
                onValueChange={setSelectedCameraId}
              >
                <SelectTrigger id="camera-filter" aria-label="Filter results by camera">
                  <SelectValue placeholder="All cameras" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All cameras</SelectItem>
                  {cameras.map((camera) => (
                    <SelectItem key={camera.id} value={camera.id}>
                      {camera.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </fieldset>

          {/* Error Message */}
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="flex items-center gap-2 text-red-500 bg-red-50 p-3 rounded-lg"
            >
              <AlertCircle className="w-5 h-5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Search Button */}
          <Button
            onClick={performSearch}
            disabled={!selectedImage || isSearching}
            className="w-full"
            aria-label={isSearching ? 'Searching for similar vehicles' : 'Search for similar vehicles'}
            aria-busy={isSearching}
          >
            {isSearching ? (
              <>
                <div
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"
                  aria-hidden="true"
                />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" aria-hidden="true" />
                <span>Search for Similar Vehicles</span>
              </>
            )}
          </Button>

          {/* Query Time */}
          {queryTime !== null && (
            <p className="text-sm text-gray-500 text-center" aria-live="polite">
              Found {results.length} matches in {queryTime.toFixed(2)}ms
            </p>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      {(isSearching || hasSearched) && (
        <Card>
          <CardHeader>
            <CardTitle id="results-heading">Search Results</CardTitle>
          </CardHeader>
          <CardContent aria-labelledby="results-heading">
            {isSearching ? (
              <div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                role="status"
                aria-label="Loading search results"
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-64 rounded-lg" aria-hidden="true" />
                ))}
                <span className="sr-only">Searching for similar vehicles, please wait...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.map((result, index) => {
                  const vehicleDescription = [
                    result.vehicle_color,
                    result.vehicle_type || 'vehicle',
                    result.license_plate || result.sparking?.vehicle?.licensePlate
                      ? `with plate ${result.license_plate || result.sparking?.vehicle?.licensePlate}`
                      : null,
                  ].filter(Boolean).join(' ')

                  return (
                  <Card
                    key={result.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Result ${index + 1}: ${vehicleDescription}, ${(result.score * 100).toFixed(1)}% match. Press Enter to select.`}
                    className="cursor-pointer hover:shadow-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    onClick={() => onResultSelect?.(result)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onResultSelect?.(result)
                      }
                    }}
                  >
                    <CardContent className="p-4 space-y-3">
                      {/* Image */}
                      <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          src={result.image_url}
                          alt={`Detected ${vehicleDescription} at ${result.sparking?.camera?.name || result.camera_id}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              '/placeholder-vehicle.png'
                          }}
                        />
                        {/* Similarity Score Badge */}
                        <div
                          className={`absolute top-2 right-2 ${getScoreColor(result.score)} text-white text-xs px-2 py-1 rounded-full`}
                          aria-hidden="true"
                        >
                          {(result.score * 100).toFixed(1)}% match
                        </div>
                      </div>

                      {/* Vehicle Info */}
                      <div className="space-y-2">
                        {/* License Plate */}
                        {(result.license_plate || result.sparking?.vehicle?.licensePlate) && (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">
                              {result.license_plate || result.sparking?.vehicle?.licensePlate}
                            </Badge>
                            {result.sparking?.vehicle?.isVip && (
                              <span title="VIP Vehicle">
                                <Crown className="w-4 h-4 text-yellow-500" aria-hidden="true" />
                                <span className="sr-only">VIP Vehicle</span>
                              </span>
                            )}
                            {result.sparking?.vehicle?.isBlacklisted && (
                              <span title="Blacklisted Vehicle">
                                <Ban className="w-4 h-4 text-red-500" aria-hidden="true" />
                                <span className="sr-only">Blacklisted Vehicle</span>
                              </span>
                            )}
                          </div>
                        )}

                        {/* Vehicle Type & Color */}
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Car className="w-4 h-4" aria-hidden="true" />
                          <span>
                            {result.vehicle_color && `${result.vehicle_color} `}
                            {result.vehicle_type || 'Vehicle'}
                          </span>
                        </div>

                        {/* Camera */}
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <CameraIcon className="w-4 h-4" aria-hidden="true" />
                          <span>
                            {result.sparking?.camera?.name || result.camera_id}
                            {result.sparking?.camera?.parkingLot && (
                              <span className="text-gray-400">
                                {' '}
                                @ {result.sparking.camera.parkingLot.name}
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Timestamp */}
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Clock className="w-4 h-4" aria-hidden="true" />
                          <span>{formatTimestamp(result.detected_at)}</span>
                        </div>

                        {/* Token Status */}
                        {result.sparking?.token && (
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                result.sparking.token.status === 'ACTIVE'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              Token: {result.sparking.token.tokenNumber}
                              {result.sparking.token.status === 'ACTIVE' && (
                                <span className="sr-only"> (Active)</span>
                              )}
                            </Badge>
                            {result.sparking.token.status === 'ACTIVE' && (
                              <CheckCircle2 className="w-4 h-4 text-green-500" aria-hidden="true" />
                            )}
                          </div>
                        )}

                        {/* Confidence */}
                        <div className="text-xs text-gray-400">
                          Detection confidence: {(result.confidence * 100).toFixed(1)}%
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  )
                })}
              </div>
            )}

            {!isSearching && hasSearched && results.length === 0 && (
              <div
                className="text-center py-8 text-gray-500"
                role="status"
                aria-live="polite"
              >
                <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" aria-hidden="true" />
                <p>No matching vehicles found</p>
                <p className="text-sm">Try adjusting search parameters or use a different image</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
