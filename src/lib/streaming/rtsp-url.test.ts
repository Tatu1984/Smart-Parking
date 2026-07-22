import { describe, it, expect } from 'vitest'
import { buildCredentialedRtspUrl, redactRtspUrl } from './rtsp-url'

describe('buildCredentialedRtspUrl', () => {
  it('injects and URL-encodes credentials into a credential-free URL', () => {
    const out = buildCredentialedRtspUrl({
      rtspUrl: 'rtsp://192.168.0.64:554/Streaming/Channels/101',
      username: 'admin',
      password: 'p@ss:word',
    })
    // '@' and ':' in the password must be percent-encoded so they don't collide
    // with RTSP URL syntax.
    expect(out).toContain('admin:p%40ss%3Aword@192.168.0.64:554')
    expect(out).toContain('/Streaming/Channels/101')
  })

  it('leaves a URL that already contains credentials untouched', () => {
    const url = 'rtsp://admin:secret@10.0.0.5:554/stream'
    expect(buildCredentialedRtspUrl({ rtspUrl: url, username: 'x', password: 'y' })).toBe(url)
  })

  it('returns the URL unchanged when no credentials are supplied', () => {
    const url = 'rtsp://10.0.0.5:554/stream'
    expect(buildCredentialedRtspUrl({ rtspUrl: url })).toBe(url)
  })

  it('injects username only when no password is given', () => {
    const out = buildCredentialedRtspUrl({
      rtspUrl: 'rtsp://cam.local:554/s',
      username: 'viewer',
    })
    expect(out).toContain('viewer@cam.local:554')
  })

  it('returns an unparseable URL unchanged', () => {
    expect(buildCredentialedRtspUrl({ rtspUrl: 'not a url', username: 'a', password: 'b' })).toBe('not a url')
  })

  it('handles empty input', () => {
    expect(buildCredentialedRtspUrl({ rtspUrl: '' })).toBe('')
  })
})

describe('redactRtspUrl', () => {
  it('masks credentials', () => {
    expect(redactRtspUrl('rtsp://admin:secret@10.0.0.5:554/stream')).toBe('rtsp://***:***@10.0.0.5:554/stream')
  })

  it('leaves credential-free URLs alone', () => {
    expect(redactRtspUrl('rtsp://10.0.0.5:554/stream')).toBe('rtsp://10.0.0.5:554/stream')
  })

  it('coarsely redacts an unparseable URL with userinfo', () => {
    expect(redactRtspUrl('rtsp://user:pass@bad host/x')).toContain('***:***@')
  })
})
