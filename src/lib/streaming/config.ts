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
  }
}

// Lazy singleton so config/env is read once, on first use.
let _provider: StreamProvider | null = null

export function getStreamProvider(): StreamProvider {
  if (_provider) return _provider
  const cfg = getStreamingConfig()
  const client = new MediaMtxClient({
    controlUrl: cfg.controlUrl,
    hlsBase: cfg.hlsPublicBase,
    webrtcBase: cfg.webrtcPublicBase,
    timeoutMs: cfg.timeoutMs,
  })
  _provider = new MediaMtxProvider(client)
  return _provider
}

/** Test seam: override the provider (used by unit tests). */
export function __setStreamProvider(provider: StreamProvider | null): void {
  _provider = provider
}
