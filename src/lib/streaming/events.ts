/**
 * Typed streaming events + a tiny in-process event bus.
 *
 * Streaming lifecycle changes are published here so multiple consumers can react
 * without coupling to each other: today the Socket.IO layer (live dashboards)
 * and connection-logging; tomorrow AI analytics, recording triggers, and
 * alerting (see docs/cctv/future-architecture.md). Consumers subscribe; the
 * streaming layer emits.
 */

export type StreamEventType =
  | 'camera.registered'
  | 'camera.unregistered'
  | 'camera.online'
  | 'camera.offline'
  | 'camera.error'
  | 'stream.started'
  | 'stream.stopped'

export interface StreamEvent {
  type: StreamEventType
  cameraId: string
  parkingLotId?: string
  zoneId?: string
  cameraName?: string
  message?: string
  at: Date
  metadata?: Record<string, unknown>
}

type Handler = (event: StreamEvent) => void

class StreamEventBus {
  private handlers = new Set<Handler>()

  /** Subscribe to all stream events. Returns an unsubscribe function. */
  subscribe(handler: Handler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  /** Publish an event to all subscribers. Handler errors are isolated so one
   *  bad consumer cannot break emission for the others. */
  emit(event: StreamEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event)
      } catch {
        // Isolated on purpose — a failing consumer must not affect others.
      }
    }
  }
}

/** Process-wide singleton bus. */
export const streamEvents = new StreamEventBus()
