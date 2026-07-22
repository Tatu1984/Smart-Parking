/**
 * Streaming module configuration + provider factory.
 *
 * Centralizes every streaming-related environment variable and constructs the
 * process-wide StreamProvider singleton. Everything else imports
 * `getStreamProvider()` — never a concrete class — so the backend technology
 * stays swappable (see providers.ts).
 */

import type { StreamProvider } from './providers'
import { MediaMtxClient } from './mediamtx-client'
import { MediaMtxProvider } from './mediamtx-provider'
import { EdgeProvider } from './edge-provider'

export interface StreamingConfig {
  /** MediaMTX control API (server-side, internal network only). */
  controlUrl: string
  /** HLS output base the BROWSER will use (must be browser-reachable). */
  hlsPublicBase: string
  /** WebRTC/WHEP output base the BROWSER will use. */
  webrtcPublicBase: string
  /** Control-API request timeout (ms). */
  timeoutMs: number
  /** Health poll interval (ms) for the health worker. */
  healthPollIntervalMs: number
  /** Whether the health worker should be bootstrapped by server.js. */
  healthWorkerEnabled: boolean
  /** Public base the browser uses to reach our edge ingest GET route. */
  edgeIngestPublicBase: string
  /** A pushed HLS stream is "live" if its playlist is newer than this (ms). */
  edgeFreshnessMs: number
}

export function getStreamingConfig(): StreamingConfig {
  return {
    controlUrl: process.env.MEDIAMTX_CONTROL_URL || 'http://mediamtx:9997',
    // MEDIAMTX_HLS_BASE / MEDIAMTX_ENDPOINT are what the browser hits, so in a
    // real deployment these are public hostnames, not the internal service name.
    hlsPublicBase: process.env.MEDIAMTX_HLS_BASE || 'http://localhost:8888',
    webrtcPublicBase: process.env.MEDIAMTX_ENDPOINT || 'http://localhost:8889',
    timeoutMs: parseInt(process.env.MEDIAMTX_TIMEOUT_MS || '5000', 10),
    healthPollIntervalMs: parseInt(process.env.CAMERA_HEALTH_POLL_INTERVAL_MS || '15000', 10),
    healthWorkerEnabled: process.env.CAMERA_HEALTH_WORKER_ENABLED === 'true',
    // Browser-reachable base for edge HLS. In prod this is the public app URL.
    edgeIngestPublicBase: process.env.EDGE_INGEST_PUBLIC_BASE || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    edgeFreshnessMs: parseInt(process.env.EDGE_FRESHNESS_MS || '20000', 10),
  }
}

/** How a camera's video reaches us. Mirrors Camera.sourceMode. */
export type SourceMode = 'MEDIAMTX_PULL' | 'EDGE_PUSH'

// Lazy singletons so config/env is read once, on first use.
let _mediamtx: StreamProvider | null = null
let _edge: StreamProvider | null = null

/** The default (MediaMTX pull) provider. */
export function getStreamProvider(): StreamProvider {
  if (_mediamtx) return _mediamtx
  const cfg = getStreamingConfig()
  const client = new MediaMtxClient({
    controlUrl: cfg.controlUrl,
    hlsBase: cfg.hlsPublicBase,
    webrtcBase: cfg.webrtcPublicBase,
    timeoutMs: cfg.timeoutMs,
  })
  _mediamtx = new MediaMtxProvider(client)
  return _mediamtx
}

/** The edge-push provider (HLS uploaded by an on-site agent). */
export function getEdgeProvider(): StreamProvider {
  if (_edge) return _edge
  const cfg = getStreamingConfig()
  _edge = new EdgeProvider(cfg.edgeIngestPublicBase, cfg.edgeFreshnessMs)
  return _edge
}

/** Pick the provider for a camera based on its sourceMode (defaults to pull). */
export function providerForCamera(camera: { sourceMode?: string | null }): StreamProvider {
  return camera.sourceMode === 'EDGE_PUSH' ? getEdgeProvider() : getStreamProvider()
}

/** Test seam: override the providers (used by unit tests). */
export function __setStreamProvider(provider: StreamProvider | null): void {
  _mediamtx = provider
}
export function __setEdgeProvider(provider: StreamProvider | null): void {
  _edge = provider
}
