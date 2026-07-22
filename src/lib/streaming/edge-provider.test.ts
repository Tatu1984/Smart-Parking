import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { EdgeProvider } from './edge-provider'
import { atomicWrite, resolveIngestPath } from './ingest-store'
import {
  providerForCamera,
  getEdgeProvider,
  getStreamProvider,
  __setEdgeProvider,
  __setStreamProvider,
} from './config'

let tmpRoot: string

beforeAll(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'edge-prov-'))
  process.env.EDGE_INGEST_DIR = tmpRoot
})
afterAll(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true })
})
beforeEach(() => {
  // Reset provider singletons between tests.
  __setEdgeProvider(null)
  __setStreamProvider(null)
})

describe('EdgeProvider', () => {
  it('builds a credential-free HLS URL at the ingest route', () => {
    const p = new EdgeProvider('https://app.example.com')
    const urls = p.playbackUrls('cam-9')
    expect(urls.hlsUrl).toBe('https://app.example.com/api/edge/ingest/cam-9/index.m3u8')
    expect(urls.webrtcUrl).toBe('')
    expect(urls.hlsUrl).not.toContain('@')
  })

  it('register/unregister are no-ops (agent pushes)', async () => {
    const p = new EdgeProvider('http://x')
    await expect(p.register({ key: 'k', rtspUrl: '' })).resolves.toBeUndefined()
    await expect(p.unregister('k')).resolves.toBeUndefined()
  })

  it('health is ready when the playlist is fresh', async () => {
    const p = new EdgeProvider('http://x', 20000)
    const { full } = resolveIngestPath('cam-fresh', 'index.m3u8')
    await atomicWrite(full, Buffer.from('#EXTM3U'))
    expect((await p.health('cam-fresh')).ready).toBe(true)
  })

  it('health is not ready when there is no playlist', async () => {
    const p = new EdgeProvider('http://x')
    expect((await p.health('never-pushed')).ready).toBe(false)
  })

  it('health is not ready when the playlist is stale', async () => {
    const p = new EdgeProvider('http://x', 1) // 1ms freshness window
    const { full } = resolveIngestPath('cam-stale', 'index.m3u8')
    await atomicWrite(full, Buffer.from('#EXTM3U'))
    await new Promise((r) => setTimeout(r, 5))
    expect((await p.health('cam-stale')).ready).toBe(false)
  })
})

describe('providerForCamera selection', () => {
  it('routes EDGE_PUSH cameras to the edge provider', () => {
    expect(providerForCamera({ sourceMode: 'EDGE_PUSH' })).toBe(getEdgeProvider())
  })

  it('routes MEDIAMTX_PULL (and default) cameras to the MediaMTX provider', () => {
    expect(providerForCamera({ sourceMode: 'MEDIAMTX_PULL' })).toBe(getStreamProvider())
    expect(providerForCamera({})).toBe(getStreamProvider())
    expect(providerForCamera({ sourceMode: null })).toBe(getStreamProvider())
  })
})
