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
  Settings,
  Wifi,
  WifiOff
} from 'lucide-react'

interface WebRTCStreamProps {
  streamId: string
  cameraName: string
  status?: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'ERROR'
  showControls?: boolean
  autoPlay?: boolean
  className?: string
  onFullscreen?: () => void
  onSnapshot?: (imageData: string) => void
}

type StreamState = 'idle' | 'connecting' | 'playing' | 'error' | 'offline'

interface ICEServer {
  urls: string | string[]
  username?: string
  credential?: string
}

export function WebRTCStream({
  streamId,
  cameraName,
  status = 'ONLINE',
  showControls = true,
  autoPlay = false,
  className = '',
  onFullscreen,
  onSnapshot
}: WebRTCStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [streamState, setStreamState] = useState<StreamState>('idle')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [retryCount, setRetryCount] = useState(0)
  const [connectionStats, setConnectionStats] = useState<{
    bitrate?: number
    packetsLost?: number
    latency?: number
  }>({})

  // Fetch WebRTC configuration from API
  const fetchWebRTCConfig = async (): Promise<{
    whepEndpoint: string
    iceServers: ICEServer[]
  }> => {
    const response = await fetch(`/api/metro/streams/${streamId}/webrtc`)
    if (!response.ok) {
      throw new Error('Failed to fetch WebRTC configuration')
    }
    const data = await response.json()
    return data.data
  }

  // Start WebRTC stream using WHEP protocol
  const startStream = useCallback(async () => {
    if (status !== 'ONLINE') {
      setStreamState('offline')
      return
    }

    setStreamState('connecting')
    setErrorMessage('')

    try {
      // Fetch ICE servers configuration
      const config = await fetchWebRTCConfig()

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: config.iceServers,
        iceCandidatePoolSize: 10,
      })
      pcRef.current = pc

      // Handle incoming tracks
      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0]
          setStreamState('playing')
          setRetryCount(0)
        }
      }

      // Handle ICE connection state changes
      pc.oniceconnectionstatechange = () => {
        switch (pc.iceConnectionState) {
          case 'connected':
          case 'completed':
            setStreamState('playing')
            break
          case 'disconnected':
            logger.warn('WebRTC: ICE disconnected, attempting reconnection')
            break
          case 'failed':
            setStreamState('error')
            setErrorMessage('Connection failed')
            break
          case 'closed':
            setStreamState('idle')
            break
        }
      }

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          setStreamState('error')
          setErrorMessage('WebRTC connection failed')
        }
      }

      // Add transceivers for receiving video and audio
      pc.addTransceiver('video', { direction: 'recvonly' })
      pc.addTransceiver('audio', { direction: 'recvonly' })

      // Create and set local offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // Wait for ICE gathering to complete (or timeout)
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve()
          return
        }

        const timeout = setTimeout(() => resolve(), 3000)
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(timeout)
            resolve()
          }
        }
      })

      // Send offer to WHEP endpoint
      const whepResponse = await fetch(`/api/metro/streams/${streamId}/webrtc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
        },
        body: pc.localDescription?.sdp,
      })

      if (!whepResponse.ok) {
        throw new Error(`WHEP negotiation failed: ${whepResponse.status}`)
      }

      // Set remote answer
      const sdpAnswer = await whepResponse.text()
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: sdpAnswer,
      })

      // Start stats monitoring
      startStatsMonitoring(pc)
    } catch (error) {
      logger.error('WebRTC stream error:', error instanceof Error ? error : undefined)

      if (retryCount < 3) {
        setRetryCount((prev) => prev + 1)
        setTimeout(startStream, 2000)
      } else {
        setStreamState('error')
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to connect to stream'
        )
      }
    }
  }, [streamId, status, retryCount])

  // Stop stream
  const stopStream = useCallback(() => {
    // Clear stats monitoring interval
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current)
      statsIntervalRef.current = null
    }
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setStreamState('idle')
    setConnectionStats({})
  }, [])

  // Monitor connection stats
  const startStatsMonitoring = (pc: RTCPeerConnection) => {
    // Clear any existing interval
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current)
    }

    statsIntervalRef.current = setInterval(async () => {
      if (pc.connectionState !== 'connected') {
        if (statsIntervalRef.current) {
          clearInterval(statsIntervalRef.current)
          statsIntervalRef.current = null
        }
        return
      }

      try {
        const stats = await pc.getStats()
        let totalBytesReceived = 0
        let totalPacketsLost = 0
        let currentRoundTripTime = 0

        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            totalBytesReceived = report.bytesReceived || 0
            totalPacketsLost = report.packetsLost || 0
          }
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            currentRoundTripTime = report.currentRoundTripTime || 0
          }
        })

        setConnectionStats({
          bitrate: totalBytesReceived,
          packetsLost: totalPacketsLost,
          latency: Math.round(currentRoundTripTime * 1000),
        })
      } catch {
        // Stats not available
      }
    }, 2000)
  }

  // Capture snapshot from video
  const captureSnapshot = () => {
    if (!videoRef.current || streamState !== 'playing') return

    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')

    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
      onSnapshot?.(dataUrl)

      // Trigger download
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `${cameraName}-snapshot-${new Date().toISOString()}.jpg`
      link.click()
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

  const getConnectionBadge = () => {
    if (streamState !== 'playing') return null

    return (
      <div className="flex items-center gap-1 text-xs text-white/80">
        <Wifi className="w-3 h-3" />
        {connectionStats.latency && `${connectionStats.latency}ms`}
      </div>
    )
  }

  return (
    <Card
      className={`overflow-hidden ${isFullscreen ? 'fixed inset-4 z-50' : ''} ${className}`}
    >
      <CardContent className="p-0 relative">
        {/* Camera Name Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-2 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-white" />
            <span className="text-white text-sm font-medium">{cameraName}</span>
            {getConnectionBadge()}
          </div>
          {getStatusBadge()}
        </div>

        {/* Video Container */}
        <div className="relative aspect-video bg-gray-900 flex items-center justify-center">
          {/* WebRTC Video Element */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-contain ${
              streamState === 'playing' ? 'block' : 'hidden'
            }`}
          />

          {/* Connecting State */}
          {streamState === 'connecting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-2" />
                <p className="text-gray-400">Establishing WebRTC connection...</p>
                {retryCount > 0 && (
                  <p className="text-gray-500 text-sm mt-1">
                    Retry attempt {retryCount}/3
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Idle State */}
          {streamState === 'idle' && (
            <div className="text-center">
              <Camera className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">WebRTC Stream not started</p>
              <Button onClick={startStream} disabled={status !== 'ONLINE'}>
                <Play className="w-4 h-4 mr-2" />
                Start Stream
              </Button>
            </div>
          )}

          {/* Offline State */}
          {streamState === 'offline' && (
            <div className="text-center">
              <WifiOff className="w-16 h-16 text-gray-600 mx-auto mb-4" />
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
                Retry Connection
              </Button>
            </div>
          )}

          {/* Live Indicator */}
          {streamState === 'playing' && (
            <div className="absolute top-12 right-2 flex items-center gap-1 px-2 py-1 bg-red-600 rounded text-white text-xs">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              LIVE (WebRTC)
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
                    disabled={status !== 'ONLINE' || streamState === 'connecting'}
                  >
                    <Play className="w-4 h-4 text-white" />
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={captureSnapshot}
                  disabled={streamState !== 'playing'}
                >
                  <Camera className="w-4 h-4 text-white" />
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setRetryCount(0)
                    stopStream()
                    setTimeout(startStream, 100)
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

// Grid component for multiple WebRTC streams
interface WebRTCStreamGridProps {
  streams: Array<{
    id: string
    name: string
    status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'ERROR'
  }>
  columns?: 1 | 2 | 3 | 4
  autoPlay?: boolean
}

export function WebRTCStreamGrid({
  streams,
  columns = 2,
  autoPlay = false,
}: WebRTCStreamGridProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  }

  return (
    <div className={`grid ${gridCols[columns]} gap-4`}>
      {streams.map((stream) => (
        <WebRTCStream
          key={stream.id}
          streamId={stream.id}
          cameraName={stream.name}
          status={stream.status}
          autoPlay={autoPlay}
        />
      ))}
    </div>
  )
}
