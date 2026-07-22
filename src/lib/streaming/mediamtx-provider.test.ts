import { describe, it, expect, vi } from 'vitest'
import { MediaMtxProvider } from './mediamtx-provider'
import { MediaMtxClient } from './mediamtx-client'

function clientWith(overrides: Partial<MediaMtxClient>): MediaMtxClient {
  const base = new MediaMtxClient({
    controlUrl: 'http://mediamtx:9997',
    hlsBase: 'http://media.example.com:8888',
    webrtcBase: 'http://media.example.com:8889',
  })
  return Object.assign(base, overrides)
}

describe('MediaMtxClient.playbackUrls', () => {
  it('builds credential-free HLS and WebRTC URLs', () => {
    const client = new MediaMtxClient({
      controlUrl: 'http://mediamtx:9997',
      hlsBase: 'http://media.example.com:8888',
      webrtcBase: 'http://media.example.com:8889',
    })
    const { hlsUrl, webrtcUrl } = client.playbackUrls('cam-1')
    expect(hlsUrl).toBe('http://media.example.com:8888/cam-1/index.m3u8')
    expect(webrtcUrl).toBe('http://media.example.com:8889/cam-1')
    // No credentials anywhere in the output.
    expect(hlsUrl).not.toContain('@')
    expect(webrtcUrl).not.toContain('@')
  })
})

describe('MediaMtxProvider.health', () => {
  it('maps a ready path to ready:true with reader count', async () => {
    const client = clientWith({
      getPath: vi.fn().mockResolvedValue({
        name: 'cam-1',
        ready: true,
        tracks: ['video'],
        readers: [{}, {}],
        source: { type: 'rtspSource' },
      }),
    })
    const provider = new MediaMtxProvider(client)
    const health = await provider.health('cam-1')
    expect(health).toEqual({
      key: 'cam-1',
      ready: true,
      readers: 2,
      tracks: ['video'],
      sourceType: 'rtspSource',
    })
  })

  it('maps a missing path (null) to ready:false', async () => {
    const client = clientWith({ getPath: vi.fn().mockResolvedValue(null) })
    const provider = new MediaMtxProvider(client)
    expect(await provider.health('cam-x')).toEqual({ key: 'cam-x', ready: false })
  })

  it('never throws on provider error — returns ready:false', async () => {
    const client = clientWith({ getPath: vi.fn().mockRejectedValue(new Error('boom')) })
    const provider = new MediaMtxProvider(client)
    expect(await provider.health('cam-e')).toEqual({ key: 'cam-e', ready: false })
  })
})

describe('MediaMtxProvider.unregister', () => {
  it('does not throw when the client removal fails (best-effort)', async () => {
    const client = clientWith({ removePath: vi.fn().mockRejectedValue(new Error('down')) })
    const provider = new MediaMtxProvider(client)
    await expect(provider.unregister('cam-1')).resolves.toBeUndefined()
  })
})
