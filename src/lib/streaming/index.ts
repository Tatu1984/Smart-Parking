/**
 * CCTV streaming module — public surface.
 *
 * Import from here (`@/lib/streaming`) rather than from individual files, and
 * depend on the interfaces + `getStreamProvider()` factory rather than any
 * concrete provider. See docs/cctv/ for the full module documentation.
 */

export type {
  StreamProvider,
  StreamSource,
  PlaybackUrls,
  StreamHealth,
  RecordingProvider,
  RecordingSegment,
  DetectionProvider,
  DetectionResult,
  NotificationProvider,
  OutboundNotification,
} from './providers'

export { MediaMtxClient } from './mediamtx-client'
export type { MediaMtxPathInfo, MediaMtxClientConfig } from './mediamtx-client'
export { MediaMtxProvider } from './mediamtx-provider'

export { buildCredentialedRtspUrl, redactRtspUrl } from './rtsp-url'
export type { BuildRtspUrlInput } from './rtsp-url'

export { streamEvents } from './events'
export type { StreamEvent, StreamEventType } from './events'

export {
  registerCameraStream,
  unregisterCameraStream,
  cameraPlaybackUrls,
  streamKeyFor,
} from './camera-stream.service'

export { CameraHealthService } from './camera-health.service'
export type { CameraHealthServiceDeps, HealthLogger } from './camera-health.service'

export {
  getStreamingConfig,
  getStreamProvider,
  __setStreamProvider,
} from './config'
export type { StreamingConfig } from './config'
