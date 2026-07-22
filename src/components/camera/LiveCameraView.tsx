'use client'

/**
 * LiveCameraView — the single live-view component for a camera.
 *
 * Replaces the old MJPEG CameraStream. Fetches credential-free playback URLs
 * from /api/cameras/[id]/playback and plays HLS by default (the primary,
 * universally-supported transport). A toggle switches to low-latency WebRTC on
 * the SAME MediaMTX path — kept as an optional mode for future/mobile use.
 *
 * Prop shape is compatible with the previous CameraStream so existing dashboard
 * usage keeps working.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Camera as CameraIcon,
  Maximize2,
  Minimize2,
  RefreshCw,
  AlertCircle,
  Loader2,
  WifiOff,
  Radio,
} from 'lucide-react'
import { HlsPlayer, type HlsPlayerState } from './HlsPlayer'
import { WebRTCStream } from './WebRTCStream'
import { logger } from '@/lib/logger'

export interface LiveCameraViewProps {
  cameraId: string
  cameraName: string
  status?: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'ERROR'
  showControls?: boolean
  autoPlay?: boolean
  className?: string
  /** Default transport. HLS is the reliable default; WebRTC is opt-in. */
  transport?: 'hls' | 'webrtc'
  onFullscreen?: () => void
  onSnapshot?: (imageData: string) => void
}

interface PlaybackConfig {
  cameraId: string
  path: string
  hlsUrl: string
  webrtcUrl: string
}

export function LiveCameraView({
  cameraId,
  cameraName,
  status = 'ONLINE',
  showControls = true,
  autoPlay = true,
  className = '',
  transport = 'hls',
  onFullscreen,
  onSnapshot,
}: LiveCameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [config, setConfig] = useState<PlaybackConfig | null>(null)
  const [mode, setMode] = useState<'hls' | 'webrtc'>(transport)
  const [playerState, setPlayerState] = useState<HlsPlayerState>('idle')
  const [loadError, setLoadError] = useState<string>('')
  const [isFullscreen, setIsFullscreen] = useState(false)

  const fetchPlayback = useCallback(async () => {
    setLoadError('')
    setPlayerState('connecting')
    try {
      const res = await fetch(`/api/cameras/${cameraId}/playback`)
      if (!res.ok) {
        throw new Error(`Failed to load playback config (${res.status})`)
      }
      const json = await res.json()
      setConfig(json.data as PlaybackConfig)
    } catch (error) {
      logger.error('LiveCameraView: playback fetch failed', error instanceof Error ? error : undefined)
      setLoadError(error instanceof Error ? error.message : 'Failed to load stream')
      setPlayerState('error')
    }
  }, [cameraId])

  useEffect(() => {
    if (status === 'ONLINE') {
      fetchPlayback()
    } else {
      setPlayerState('idle')
    }
  }, [status, fetchPlayback])

  const captureSnapshot = () => {
    const video = videoRef.current
    if (!video || playerState !== 'playing') return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    onSnapshot?.(dataUrl)
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `${cameraName}-${new Date().toISOString()}.jpg`
    link.click()
  }

  const toggleFullscreen = () => {
    setIsFullscreen((v) => !v)
    onFullscreen?.()
  }

  const statusBadge = () => {
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

  // WebRTC mode delegates to the existing WHEP player on the same path.
  if (mode === 'webrtc' && status === 'ONLINE') {
    return (
      <div className={isFullscreen ? 'fixed inset-4 z-50' : className}>
        <WebRTCStream
          streamId={config?.path || cameraId}
          cameraName={cameraName}
          status={status}
          autoPlay={autoPlay}
          showControls={showControls}
          onFullscreen={toggleFullscreen}
          onSnapshot={onSnapshot}
        />
        {showControls && (
          <div className="mt-1 flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => setMode('hls')}>
              Switch to HLS
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className={`overflow-hidden ${isFullscreen ? 'fixed inset-4 z-50' : ''} ${className}`}>
      <CardContent className="p-0 relative">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-2 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center gap-2">
            <CameraIcon className="w-4 h-4 text-white" />
            <span className="text-white text-sm font-medium">{cameraName}</span>
          </div>
          {statusBadge()}
        </div>

        <div className="relative aspect-video bg-gray-900 flex items-center justify-center">
          {status === 'ONLINE' && config && (
            <HlsPlayer
              src={config.hlsUrl}
              videoRef={videoRef}
              autoPlay={autoPlay}
              muted
              onStateChange={setPlayerState}
              className={`w-full h-full object-contain ${playerState === 'playing' ? 'block' : 'hidden'}`}
            />
          )}

          {status === 'ONLINE' && (playerState === 'connecting' || playerState === 'buffering') && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-2" />
                <p className="text-gray-400">
                  {playerState === 'buffering' ? 'Buffering…' : 'Connecting to stream…'}
                </p>
              </div>
            </div>
          )}

          {status !== 'ONLINE' && (
            <div className="text-center">
              <WifiOff className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Camera is {status.toLowerCase()}</p>
            </div>
          )}

          {status === 'ONLINE' && playerState === 'error' && (
            <div className="text-center">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <p className="text-red-400">{loadError || 'Stream error'}</p>
              <Button variant="outline" className="mt-4" onClick={fetchPlayback}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          )}

          {playerState === 'playing' && (
            <div className="absolute top-12 right-2 flex items-center gap-1 px-2 py-1 bg-red-600 rounded text-white text-xs">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              LIVE (HLS)
            </div>
          )}
        </div>

        {showControls && (
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={captureSnapshot} disabled={playerState !== 'playing'}>
                  <CameraIcon className="w-4 h-4 text-white" />
                </Button>
                <Button size="sm" variant="ghost" onClick={fetchPlayback} disabled={status !== 'ONLINE'}>
                  <RefreshCw className="w-4 h-4 text-white" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setMode('webrtc')}
                  disabled={status !== 'ONLINE'}
                  title="Switch to low-latency WebRTC"
                >
                  <Radio className="w-4 h-4 text-white" />
                </Button>
              </div>
              <Button size="sm" variant="ghost" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-white" />}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Grid of live camera views. */
export function LiveCameraGrid({
  cameras,
  columns = 2,
  autoPlay = false,
}: {
  cameras: Array<{ id: string; name: string; status?: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'ERROR' }>
  columns?: 1 | 2 | 3 | 4
  autoPlay?: boolean
}) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  }
  return (
    <div className={`grid ${gridCols[columns]} gap-4`}>
      {cameras.map((c) => (
        <LiveCameraView key={c.id} cameraId={c.id} cameraName={c.name} status={c.status} autoPlay={autoPlay} />
      ))}
    </div>
  )
}
