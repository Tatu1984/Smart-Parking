/**
 * Streaming provider abstractions.
 *
 * These interfaces are the seam between SParking's camera/streaming business
 * logic and the concrete technology that fulfils it. Business logic (API routes,
 * services, the health worker) depends ONLY on these interfaces — never on
 * MediaMTX (or any future backend) directly. That lets us swap the underlying
 * implementation — MediaMTX today; a cloud service (AWS Kinesis Video, Azure
 * Video Indexer), an on-prem VMS (Milestone, Nx Witness), an edge-agent fleet,
 * or a distributed MediaMTX cluster later — without touching business logic.
 *
 * Only StreamProvider has a concrete implementation in this milestone
 * (MediaMtxProvider). RecordingProvider, DetectionProvider and NotificationProvider
 * are defined now as forward-looking seams so their features (Phase 3/4 in
 * docs/cctv/future-architecture.md) slot in without a refactor.
 */

// ============================================================================
// Shared types
// ============================================================================

/** A camera source as the streaming layer needs to see it. Credentials are the
 *  DECRYPTED, ready-to-use values — they live only server-side and are never
 *  returned to a browser. */
export interface StreamSource {
  /** Stable id used as the provider path/key. Defaults to the camera id. */
  key: string
  /** Full RTSP URL. May already embed credentials, or be credential-free with
   *  username/password supplied separately. */
  rtspUrl: string
  username?: string
  password?: string
  /** Transport hint; providers default to TCP for firewall resilience. */
  transport?: 'tcp' | 'udp'
}

/** Credential-free playback URLs handed to the browser. Never contains RTSP
 *  credentials — this is the core security invariant of the CCTV module. */
export interface PlaybackUrls {
  key: string
  /** HLS manifest URL (primary playback path). */
  hlsUrl: string
  /** WebRTC/WHEP URL (optional, low-latency, same underlying stream). */
  webrtcUrl: string
}

/** Liveness of a source as observed at the streaming layer. */
export interface StreamHealth {
  key: string
  /** True when the provider currently has a ready, readable stream. */
  ready: boolean
  /** Number of active readers/viewers, when the provider reports it. */
  readers?: number
  /** Media tracks present (e.g. ["video", "audio"]), when reported. */
  tracks?: string[]
  /** Raw source kind reported by the provider (diagnostic only). */
  sourceType?: string
}

// ============================================================================
// StreamProvider — implemented now (MediaMtxProvider)
// ============================================================================

/**
 * Registers camera sources for playback and reports their health. The single
 * abstraction the rest of the CCTV module is built on.
 */
export interface StreamProvider {
  /** Provider identifier for logs/diagnostics (e.g. "mediamtx"). */
  readonly name: string

  /** Ensure the provider is pulling/serving this source. Idempotent: calling
   *  again with the same key refreshes configuration rather than erroring. */
  register(source: StreamSource): Promise<void>

  /** Stop serving a source and release its resources. Idempotent: a missing
   *  source is treated as success. */
  unregister(key: string): Promise<void>

  /** Resolve the credential-free playback URLs for a source key. Does not
   *  require the source to be live yet. */
  playbackUrls(key: string): PlaybackUrls

  /** Query current liveness. Returns ready:false (never throws) when the
   *  source is not currently active. */
  health(key: string): Promise<StreamHealth>
}

// ============================================================================
// Forward-looking seams — interfaces only in this milestone (no impl yet)
// ============================================================================

export interface RecordingSegment {
  id: string
  key: string
  startedAt: Date
  endedAt?: Date
  url?: string
  sizeBytes?: number
}

/** Phase 4: recording, playback, timeline, cloud archive. */
export interface RecordingProvider {
  readonly name: string
  startRecording(key: string): Promise<RecordingSegment>
  stopRecording(key: string): Promise<RecordingSegment>
  listRecordings(key: string, range?: { from: Date; to: Date }): Promise<RecordingSegment[]>
  getRecording(id: string): Promise<RecordingSegment | null>
}

export interface DetectionResult {
  key: string
  type: 'OBJECT' | 'LICENSE_PLATE' | 'OCCUPANCY' | 'INTRUSION' | 'FACE'
  confidence: number
  bbox?: { x: number; y: number; width: number; height: number }
  label?: string
  licensePlate?: string
  detectedAt: Date
  metadata?: Record<string, unknown>
}

/** Phase 3: AI analytics — ANPR/LPR, object/occupancy/intrusion detection.
 *  Designed to wrap SParking's existing DetectionEvent + AI pipeline. */
export interface DetectionProvider {
  readonly name: string
  submitFrame(key: string, frame: Buffer): Promise<DetectionResult[]>
  subscribe(key: string, handler: (result: DetectionResult) => void): () => void
}

export interface OutboundNotification {
  channel: 'EMAIL' | 'SMS' | 'PUSH' | 'WEBHOOK' | 'SOCKET'
  to?: string
  title: string
  message: string
  data?: Record<string, unknown>
}

/** Event-based alerts (camera offline, intrusion, overstay…). Will front the
 *  existing Notification model / email / socket layer. */
export interface NotificationProvider {
  readonly name: string
  notify(notification: OutboundNotification): Promise<void>
}
