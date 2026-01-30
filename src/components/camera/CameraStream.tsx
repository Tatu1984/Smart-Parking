'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { logger } from '@/lib/logger'
import {
  Play,
  Pause,
  Maximize2,
  Minimize2,
  RefreshCw,
  Camera,
  AlertCircle,
  Loader2,
  Volume2,
  VolumeX,
  Settings
} from 'lucide-react'

interface CameraStreamProps {
  cameraId: string
  cameraName: string
  status?: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'ERROR'
  showControls?: boolean
  autoPlay?: boolean
  className?: string
  onFullscreen?: () => void
  onSnapshot?: (imageData: string) => void
}

type StreamState = 'idle' | 'loading' | 'playing' | 'error' | 'offline'

export function CameraStream({
  cameraId,
  cameraName,
  status = 'ONLINE',
  showControls = true,
  autoPlay = false,
  className = '',
  onFullscreen,
  onSnapshot
}: CameraStreamProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [streamState, setStreamState] = useState<StreamState>('idle')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [retryCount, setRetryCount] = useState(0)

  const streamUrl = `/api/cameras/${cameraId}/stream`
  const snapshotUrl = `/api/cameras/${cameraId}/snapshot`

  // Start stream
  const startStream = useCallback(() => {
    if (status !== 'ONLINE') {
      setStreamState('offline')
      return
    }

    setStreamState('loading')
    setErrorMessage('')

    if (imgRef.current) {
      // Add cache-busting parameter
      imgRef.current.src = `${streamUrl}?t=${Date.now()}`
    }
  }, [streamUrl, status])

  // Stop stream
  const stopStream = useCallback(() => {
    if (imgRef.current) {
      imgRef.current.src = ''
    }
    setStreamState('idle')
  }, [])

  // Handle image load success
  const handleLoad = () => {
    setStreamState('playing')
    setRetryCount(0)
  }

  // Handle image load error
  const handleError = () => {
    if (retryCount < 3) {
      setRetryCount(prev => prev + 1)
      setTimeout(startStream, 2000) // Retry after 2 seconds
    } else {
      setStreamState('error')
      setErrorMessage('Failed to connect to camera stream')
    }
  }

  // Capture snapshot
  const captureSnapshot = async () => {
    try {
      const response = await fetch(snapshotUrl)
      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        onSnapshot?.(url)

        // Also trigger download
        const a = document.createElement('a')
        a.href = url
        a.download = `${cameraName}-snapshot-${new Date().toISOString()}.jpg`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      logger.error('Snapshot error:', error instanceof Error ? error : undefined)
    }
  }

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
    onFullscreen?.()
  }

  // Auto-play on mount if enabled
  useEffect(() => {
    if (autoPlay && status === 'ONLINE') {
      startStream()
    }

    return () => {
      stopStream()
    }
  }, [autoPlay, status, startStream, stopStream])

  // Update state when status changes
  useEffect(() => {
    if (status !== 'ONLINE') {
      setStreamState('offline')
      stopStream()
    }
  }, [status, stopStream])

  const getStatusBadge = () => {
    switch (status) {
      case 'ONLINE':
        return <Badge className="bg-green-600">Online</Badge>
      case 'OFFLINE':
        return <Badge variant="destructive">Offline</Badge>
      case 'MAINTENANCE':
        return <Badge className="bg-yellow-600">Maintenance</Badge>
      case 'ERROR':
        return <Badge variant="destructive">Error</Badge>
      default:
        return null
    }
  }

  return (
    <Card className={`overflow-hidden ${isFullscreen ? 'fixed inset-4 z-50' : ''} ${className}`}>
      <CardContent className="p-0 relative">
        {/* Camera Name Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-2 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-white" />
            <span className="text-white text-sm font-medium">{cameraName}</span>
          </div>
          {getStatusBadge()}
        </div>

        {/* Video Container */}
        <div className="relative aspect-video bg-gray-900 flex items-center justify-center">
          {/* MJPEG Stream Image */}
          {streamState === 'playing' || streamState === 'loading' ? (
            <img
              ref={imgRef}
              alt={`${cameraName} stream`}
              className="w-full h-full object-contain"
              onLoad={handleLoad}
              onError={handleError}
            />
          ) : null}

          {/* Loading State */}
          {streamState === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-2" />
                <p className="text-gray-400">Connecting to camera...</p>
              </div>
            </div>
          )}

          {/* Idle State */}
          {streamState === 'idle' && (
            <div className="text-center">
              <Camera className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">Stream not started</p>
              <Button onClick={startStream} disabled={status !== 'ONLINE'}>
                <Play className="w-4 h-4 mr-2" />
                Start Stream
              </Button>
            </div>
          )}

          {/* Offline State */}
          {streamState === 'offline' && (
            <div className="text-center">
              <VolumeX className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Camera is offline</p>
              <p className="text-gray-500 text-sm mt-2">
                Check camera connection and try again
              </p>
            </div>
          )}

          {/* Error State */}
          {streamState === 'error' && (
            <div className="text-center">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <p className="text-red-400">{errorMessage}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setRetryCount(0)
                  startStream()
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          )}

          {/* Live Indicator */}
          {streamState === 'playing' && (
            <div className="absolute top-12 right-2 flex items-center gap-1 px-2 py-1 bg-red-600 rounded text-white text-xs">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              LIVE
            </div>
          )}
        </div>

        {/* Controls */}
        {showControls && (
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {streamState === 'playing' ? (
                  <Button size="sm" variant="ghost" onClick={stopStream}>
                    <Pause className="w-4 h-4 text-white" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={startStream}
                    disabled={status !== 'ONLINE'}
                  >
                    <Play className="w-4 h-4 text-white" />
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={captureSnapshot}
                  disabled={status !== 'ONLINE'}
                >
                  <Camera className="w-4 h-4 text-white" />
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setRetryCount(0)
                    startStream()
                  }}
                  disabled={status !== 'ONLINE'}
                >
                  <RefreshCw className="w-4 h-4 text-white" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={toggleFullscreen}>
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4 text-white" />
                  ) : (
                    <Maximize2 className="w-4 h-4 text-white" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Grid component for multiple cameras
interface CameraGridProps {
  cameras: Array<{
    id: string
    name: string
    status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'ERROR'
  }>
  columns?: 1 | 2 | 3 | 4
  autoPlay?: boolean
}

export function CameraGrid({ cameras, columns = 2, autoPlay = false }: CameraGridProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  }

  return (
    <div className={`grid ${gridCols[columns]} gap-4`}>
      {cameras.map((camera) => (
        <CameraStream
          key={camera.id}
          cameraId={camera.id}
          cameraName={camera.name}
          status={camera.status}
          autoPlay={autoPlay}
        />
      ))}
    </div>
  )
}
