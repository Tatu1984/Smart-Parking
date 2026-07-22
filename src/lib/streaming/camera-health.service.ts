/**
 * CameraHealthService — polls the streaming provider for each camera's liveness
 * and reconciles it into the database, connection logs, metrics, and live events.
 *
 * DECOUPLED BY DESIGN: this service owns its own polling lifecycle (start/stop)
 * and depends only on the StreamProvider interface, Prisma, and the event bus.
 * It has no knowledge of the HTTP server. server.js merely bootstraps it today
 * (via src/workers/camera-health.ts); it can be lifted into a standalone worker
 * process with zero code changes. See docs/cctv/architecture.md.
 *
 * It writes a connection-log row and flips status ONLY on a state transition, so
 * a steady-state camera produces no log churn (same approach as the reference).
 */

import type { PrismaClient } from '@prisma/client'
import type { LogContext } from '@/lib/logger'
import type { StreamProvider } from './providers'
import { streamEvents } from './events'

/** Structural subset of the app logger this service needs. */
export interface HealthLogger {
  info(message: string, context?: LogContext): void
  warn(message: string, context?: LogContext): void
  error(message: string, error?: Error, context?: LogContext): void
  debug(message: string, context?: LogContext): void
}

export interface CameraHealthServiceDeps {
  prisma: PrismaClient
  /** Default provider, used when providerFor is not supplied. */
  provider: StreamProvider
  /** Optional per-camera provider selector (e.g. by sourceMode). Falls back to
   *  `provider` when omitted. */
  providerFor?: (camera: { sourceMode?: string | null }) => StreamProvider
  logger: HealthLogger
  /** Poll interval in ms. */
  intervalMs: number
}

export class CameraHealthService {
  private timer: NodeJS.Timeout | null = null
  private running = false
  private polling = false

  constructor(private readonly deps: CameraHealthServiceDeps) {}

  /** Begin polling. Idempotent. Runs one poll immediately, then on an interval. */
  start(): void {
    if (this.running) return
    this.running = true
    this.deps.logger.info('CameraHealthService started', {
      intervalMs: this.deps.intervalMs,
      provider: this.deps.provider.name,
    })
    // Immediate first poll, then schedule.
    void this.pollOnce()
    this.timer = setInterval(() => void this.pollOnce(), this.deps.intervalMs)
    // Don't keep the event loop alive solely for this timer.
    this.timer.unref?.()
  }

  /** Stop polling. Idempotent. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.running = false
    this.deps.logger.info('CameraHealthService stopped')
  }

  /**
   * Poll every active camera once and reconcile state. Guarded so overlapping
   * intervals (slow provider) don't run concurrently.
   */
  async pollOnce(): Promise<void> {
    if (this.polling) return
    this.polling = true
    const { prisma, provider, logger } = this.deps
    try {
      const cameras = await prisma.camera.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          status: true,
          mediaMtxPath: true,
          sourceMode: true,
          parkingLotId: true,
          zoneId: true,
          lastOnlineAt: true,
        },
      })

      for (const cam of cameras) {
        const key = cam.mediaMtxPath || cam.id
        const activeProvider = this.deps.providerFor ? this.deps.providerFor(cam) : provider
        let ready = false
        try {
          const health = await activeProvider.health(key)
          ready = health.ready
        } catch (error) {
          logger.debug('health poll: provider error', {
            cameraId: cam.id,
            error: error instanceof Error ? error.message : String(error),
          })
          ready = false
        }

        const newStatus = ready ? 'ONLINE' : 'OFFLINE'
        if (newStatus === cam.status) continue // no transition — nothing to do

        await this.applyTransition({
          cameraId: cam.id,
          cameraName: cam.name,
          parkingLotId: cam.parkingLotId,
          zoneId: cam.zoneId,
          from: cam.status,
          to: newStatus,
          key,
          hasBeenOnline: cam.lastOnlineAt !== null,
        })
      }
    } catch (error) {
      logger.error(
        'CameraHealthService poll failed',
        error instanceof Error ? error : undefined
      )
    } finally {
      this.polling = false
    }
  }

  private async applyTransition(args: {
    cameraId: string
    cameraName: string
    parkingLotId: string
    zoneId: string | null
    from: string
    to: 'ONLINE' | 'OFFLINE'
    key: string
    hasBeenOnline: boolean
  }): Promise<void> {
    const { prisma, logger } = this.deps
    const now = new Date()
    const cameOnline = args.to === 'ONLINE'

    // Update status + metrics. A camera that RECOVERS (comes back online after
    // having been online before) increments reconnectCount. The very first
    // time a camera comes online is not a reconnect.
    const isReconnect = cameOnline && args.hasBeenOnline
    await prisma.camera.update({
      where: { id: args.cameraId },
      data: cameOnline
        ? {
            status: 'ONLINE',
            lastPingAt: now,
            lastOnlineAt: now,
            ...(isReconnect && { reconnectCount: { increment: 1 } }),
          }
        : {
            status: 'OFFLINE',
            lastOfflineAt: now,
          },
    })

    const eventType = cameOnline ? 'CONNECTED' : 'DISCONNECTED'
    const message = `health poll: ${args.key} ${args.from} → ${args.to}`
    await prisma.cameraConnectionLog.create({
      data: { cameraId: args.cameraId, eventType, message },
    })

    logger.info('Camera state change', {
      cameraId: args.cameraId,
      camera: args.cameraName,
      from: args.from,
      to: args.to,
    })

    streamEvents.emit({
      type: cameOnline ? 'camera.online' : 'camera.offline',
      cameraId: args.cameraId,
      cameraName: args.cameraName,
      parkingLotId: args.parkingLotId,
      zoneId: args.zoneId ?? undefined,
      message,
      at: now,
    })
  }
}
