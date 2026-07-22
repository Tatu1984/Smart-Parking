/**
 * Camera health worker entrypoint.
 *
 * Constructs and runs the decoupled CameraHealthService. Today it is bootstrapped
 * in-process by Next's instrumentation hook (src/instrumentation.ts), guarded by
 * CAMERA_HEALTH_WORKER_ENABLED. Because CameraHealthService depends only on
 * interfaces (StreamProvider, Prisma, logger), this entrypoint can be executed
 * as a standalone Node process later — split "API server" and "worker" without
 * touching the service. See docs/cctv/deployment.md §Workers.
 */

import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { getStreamProvider, getStreamingConfig } from '@/lib/streaming'
import { CameraHealthService } from '@/lib/streaming/camera-health.service'

let singleton: CameraHealthService | null = null

/**
 * Start the camera health worker. Idempotent — repeated calls (e.g. HMR in dev)
 * reuse the existing instance instead of spawning duplicate pollers.
 */
export function startCameraHealthWorker(): CameraHealthService {
  if (singleton) return singleton

  const cfg = getStreamingConfig()
  singleton = new CameraHealthService({
    prisma,
    provider: getStreamProvider(),
    logger,
    intervalMs: cfg.healthPollIntervalMs,
  })
  singleton.start()

  // Best-effort graceful shutdown so we don't leak a poller between reloads.
  const stop = () => singleton?.stop()
  process.once('SIGTERM', stop)
  process.once('SIGINT', stop)

  return singleton
}

/** Stop the worker if running (used in tests / graceful shutdown). */
export function stopCameraHealthWorker(): void {
  singleton?.stop()
  singleton = null
}
