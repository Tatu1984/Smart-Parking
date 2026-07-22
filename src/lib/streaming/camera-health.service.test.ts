import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CameraHealthService } from './camera-health.service'
import { streamEvents } from './events'
import type { StreamProvider, StreamHealth } from './providers'

// Minimal in-memory Prisma double for the camera + connection-log tables the
// service touches. Tracks the camera row so status/metric transitions are visible.
function makePrisma(initialStatus: 'ONLINE' | 'OFFLINE') {
  const camera = {
    id: 'cam-1',
    name: 'Cam 1',
    status: initialStatus,
    mediaMtxPath: null as string | null,
    parkingLotId: 'lot-1',
    zoneId: null as string | null,
    reconnectCount: 0,
    lastOnlineAt: null as Date | null,
    lastOfflineAt: null as Date | null,
  }
  const logs: Array<{ cameraId: string; eventType: string; message?: string | null }> = []

  const prisma = {
    camera: {
      findMany: vi.fn(async () => [camera]),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (typeof data.status === 'string') camera.status = data.status as typeof camera.status
        if (data.lastOnlineAt) camera.lastOnlineAt = data.lastOnlineAt as Date
        if (data.lastOfflineAt) camera.lastOfflineAt = data.lastOfflineAt as Date
        const rc = data.reconnectCount as { increment?: number } | undefined
        if (rc?.increment) camera.reconnectCount += rc.increment
        return camera
      }),
    },
    cameraConnectionLog: {
      create: vi.fn(async ({ data }: { data: { cameraId: string; eventType: string; message?: string | null } }) => {
        logs.push(data)
        return data
      }),
    },
  }
  return { prisma, camera, logs }
}

function provider(readyRef: { ready: boolean }): StreamProvider {
  return {
    name: 'fake',
    register: vi.fn(async () => {}),
    unregister: vi.fn(async () => {}),
    playbackUrls: (key) => ({ key, hlsUrl: '', webrtcUrl: '' }),
    health: vi.fn(async (key): Promise<StreamHealth> => ({ key, ready: readyRef.ready })),
  }
}

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} }

describe('CameraHealthService', () => {
  let events: string[]
  let unsub: () => void

  beforeEach(() => {
    events = []
    unsub = streamEvents.subscribe((e) => events.push(e.type))
    return () => unsub()
  })

  it('reconciles OFFLINE→ONLINE→OFFLINE→ONLINE with logs, events, and reconnect metric', async () => {
    const readyRef = { ready: true }
    const { prisma, camera, logs } = makePrisma('OFFLINE')
    const svc = new CameraHealthService({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
      provider: provider(readyRef),
      logger: noopLogger,
      intervalMs: 999999,
    })

    readyRef.ready = true
    await svc.pollOnce()
    expect(camera.status).toBe('ONLINE')
    expect(camera.lastOnlineAt).not.toBeNull()

    readyRef.ready = false
    await svc.pollOnce()
    expect(camera.status).toBe('OFFLINE')
    expect(camera.lastOfflineAt).not.toBeNull()

    readyRef.ready = true
    await svc.pollOnce()
    expect(camera.status).toBe('ONLINE')
    // Returning after having been ONLINE increments the reconnect counter.
    expect(camera.reconnectCount).toBe(1)

    unsub()
    expect(logs.map((l) => l.eventType)).toEqual(['CONNECTED', 'DISCONNECTED', 'CONNECTED'])
    expect(events).toEqual(['camera.online', 'camera.offline', 'camera.online'])
  })

  it('writes nothing when status does not change (no log churn)', async () => {
    const readyRef = { ready: true }
    const { prisma, logs } = makePrisma('ONLINE') // already online
    const svc = new CameraHealthService({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
      provider: provider(readyRef),
      logger: noopLogger,
      intervalMs: 999999,
    })

    await svc.pollOnce()
    await svc.pollOnce()

    expect(prisma.camera.update).not.toHaveBeenCalled()
    expect(logs).toHaveLength(0)
    unsub()
    expect(events).toEqual([])
  })
})
