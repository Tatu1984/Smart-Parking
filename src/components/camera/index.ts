// Live camera view (HLS primary, WebRTC optional) — replaces the old MJPEG player.
export { LiveCameraView, LiveCameraGrid } from './LiveCameraView'
export type { LiveCameraViewProps } from './LiveCameraView'
export { HlsPlayer } from './HlsPlayer'
export { WebRTCStream, WebRTCStreamGrid } from './WebRTCStream'

// Back-compat aliases so existing imports (CameraStream / CameraGrid) keep working.
export { LiveCameraView as CameraStream, LiveCameraGrid as CameraGrid } from './LiveCameraView'
