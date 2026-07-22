'use client'

/**
 * HLS video player. Plays a CREDENTIAL-FREE HLS manifest URL.
 *
 * Safari (and any browser advertising native HLS) plays the URL directly;
 * everything else uses hls.js. The `src` is always a credential-free playback
 * URL from /api/cameras/[id]/playback — RTSP credentials never reach here.
 */

import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { logger } from '@/lib/logger'

export type HlsPlayerState = 'idle' | 'connecting' | 'buffering' | 'playing' | 'error'

interface HlsPlayerProps {
  src: string
  className?: string
  muted?: boolean
  autoPlay?: boolean
  onStateChange?: (state: HlsPlayerState) => void
  /** Forwards the underlying <video> element so a parent can snapshot it. */
  videoRef?: React.RefObject<HTMLVideoElement | null>
}

export function HlsPlayer({
  src,
  className = '',
  muted = true,
  autoPlay = true,
  onStateChange,
  videoRef: externalRef,
}: HlsPlayerProps) {
  const internalRef = useRef<HTMLVideoElement>(null)
  const videoRef = externalRef ?? internalRef
  const [state, setState] = useState<HlsPlayerState>('connecting')

  useEffect(() => {
    onStateChange?.(state)
  }, [state, onStateChange])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    let hls: Hls | null = null

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari / iOS).
      video.src = src
      if (autoPlay) video.play().catch(() => {})
    } else if (Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: true, backBufferLength: 30 })
      hls.loadSource(src)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoPlay) video.play().catch(() => {})
      })
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) {
          logger.warn('HLS fatal error', { type: data.type, details: data.details })
          setState('error')
        }
      })
    } else {
      logger.warn('HLS not supported in this browser')
      // One-time capability failure — no external system to subscribe to here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState('error')
      return
    }

    // Media-element events drive state (the "subscribe to an external system"
    // pattern). loadstart fires when the new source begins loading → connecting.
    const onLoadStart = () => setState('connecting')
    const onPlaying = () => setState('playing')
    const onWaiting = () => setState('buffering')
    const onError = () => setState('error')
    video.addEventListener('loadstart', onLoadStart)
    video.addEventListener('playing', onPlaying)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('error', onError)

    return () => {
      video.removeEventListener('loadstart', onLoadStart)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('error', onError)
      if (hls) {
        hls.destroy()
      } else {
        // Native path: detach the source so the element stops fetching.
        video.removeAttribute('src')
        video.load()
      }
    }
  }, [src, autoPlay, videoRef])

  return (
    <video
      ref={videoRef}
      className={className}
      controls={false}
      autoPlay={autoPlay}
      muted={muted}
      playsInline
    />
  )
}
