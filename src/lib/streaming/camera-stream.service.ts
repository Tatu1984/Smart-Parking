/**
 * Camera ↔ streaming-provider orchestration used by the camera API routes.
 *
 * Keeps MediaMTX (provider) orchestration out of the HTTP handlers and in one
 * place: registering/refreshing a camera's stream path on create/update,
 * removing it on delete, resolving credential-free playback URLs, and writing
 * connection-log rows + lifecycle events. Depends only on the StreamProvider
 * interface + Prisma, so it is provider-agnostic.
 */

import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { decrypt } from '@/lib/crypto/encryption'
import { providerForCamera } from './config'
import { streamEvents } from './events'
import type { PlaybackUrls } from './providers'

/** The stream key for a camera (its explicit path or, by default, its id). */
export function streamKeyFor(camera: { id: string; mediaMtxPath?: string | null }): string {
  return camera.mediaMtxPath || camera.id
}

interface CameraForStream {
  id: string
  name: string
  rtspUrl: string
  username: string | null
  password: string | null
  mediaMtxPath: string | null
  sourceMode?: string | null
  parkingLotId: string
  zoneId: string | null
}

/**
 * Register (or refresh) a camera's stream with the provider. Credentials are
 * decrypted here and used only to configure the provider — never returned.
 * Best-effort: failures are logged and surfaced to the caller, but the caller
 * decides whether a provider failure should fail the whole request.
 */
export async function registerCameraStream(camera: CameraForStream): Promise<void> {
  const provider = providerForCamera(camera)
  const key = streamKeyFor(camera)

  await provider.register({
    key,
    rtspUrl: camera.rtspUrl,
    username: camera.username ? safeDecrypt(camera.username) : undefined,
    password: camera.password ? safeDecrypt(camera.password) : undefined,
    transport: 'tcp',
  })

  await prisma.cameraConnectionLog.create({
    data: { cameraId: camera.id, eventType: 'REGISTERED', message: `stream path: ${key}` },
  })

  streamEvents.emit({
    type: 'camera.registered',
    cameraId: camera.id,
    cameraName: camera.name,
    parkingLotId: camera.parkingLotId,
    zoneId: camera.zoneId ?? undefined,
    at: new Date(),
    message: `stream path: ${key}`,
  })
}

/** Remove a camera's stream from the provider. Best-effort; never throws. */
export async function unregisterCameraStream(camera: {
  id: string
  name?: string
  mediaMtxPath?: string | null
  sourceMode?: string | null
  parkingLotId?: string
  zoneId?: string | null
}): Promise<void> {
  const provider = providerForCamera(camera)
  const key = streamKeyFor(camera)
  try {
    await provider.unregister(key)
    await prisma.cameraConnectionLog.create({
      data: { cameraId: camera.id, eventType: 'UNREGISTERED', message: `stream path: ${key}` },
    })
    streamEvents.emit({
      type: 'camera.unregistered',
      cameraId: camera.id,
      cameraName: camera.name,
      parkingLotId: camera.parkingLotId,
      zoneId: camera.zoneId ?? undefined,
      at: new Date(),
    })
  } catch (error) {
    logger.warn('unregisterCameraStream failed (continuing)', {
      cameraId: camera.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/** Resolve credential-free playback URLs for a camera (provider by sourceMode). */
export function cameraPlaybackUrls(camera: { id: string; mediaMtxPath?: string | null; sourceMode?: string | null }): PlaybackUrls {
  return providerForCamera(camera).playbackUrls(streamKeyFor(camera))
}

function safeDecrypt(value: string): string {
  try {
    return decrypt(value)
  } catch {
    // decrypt() already returns plaintext unchanged when not in cipher format;
    // this catch only guards genuinely corrupt values.
    logger.warn('camera credential decrypt failed; using raw value')
    return value
  }
}
