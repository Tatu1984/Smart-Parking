/**
 * Low-level client for the MediaMTX control API (default :9997).
 *
 * MediaMTX is the media server that ingests RTSP and republishes it as HLS and
 * WebRTC. This client drives it over its HTTP control API — we never
 * re-implement RTSP ourselves. The control API is bound to the internal Docker
 * network only (see docker/mediamtx/mediamtx.yml) and is never exposed publicly.
 *
 * API reference: MediaMTX v3 control API (/v3/config/paths/*, /v3/paths/*).
 */

import { logger } from '@/lib/logger'

export interface MediaMtxPathInfo {
  name: string
  ready: boolean
  tracks?: string[]
  readers?: unknown[]
  source?: { type?: string } | null
}

export interface MediaMtxClientConfig {
  /** Control API base, e.g. http://mediamtx:9997 */
  controlUrl: string
  /** HLS output base, e.g. http://mediamtx:8888 (server-side) or a public host. */
  hlsBase: string
  /** WebRTC/WHEP output base, e.g. http://mediamtx:8889. */
  webrtcBase: string
  /** Per-request timeout in ms. */
  timeoutMs?: number
}

export class MediaMtxClient {
  private readonly controlUrl: string
  private readonly hlsBase: string
  private readonly webrtcBase: string
  private readonly timeoutMs: number

  constructor(config: MediaMtxClientConfig) {
    this.controlUrl = config.controlUrl.replace(/\/$/, '')
    this.hlsBase = config.hlsBase.replace(/\/$/, '')
    this.webrtcBase = config.webrtcBase.replace(/\/$/, '')
    this.timeoutMs = config.timeoutMs ?? 5000
  }

  private async request(method: string, path: string, body?: unknown): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      return await fetch(`${this.controlUrl}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Configure MediaMTX to PULL a source RTSP URL into a named path. Idempotent:
   * if the path already exists it is replaced (patch), otherwise added.
   */
  async addOrReplacePath(name: string, sourceRtsp: string): Promise<void> {
    const payload = {
      source: sourceRtsp,
      sourceOnDemand: false,
      rtspTransport: 'tcp',
    }

    // Try add first; if it already exists MediaMTX returns 400/409 — patch it.
    const addRes = await this.request('POST', `/v3/config/paths/add/${encodeURIComponent(name)}`, payload)
    if (addRes.ok) return

    if (addRes.status === 400 || addRes.status === 409) {
      const patchRes = await this.request('PATCH', `/v3/config/paths/patch/${encodeURIComponent(name)}`, payload)
      if (patchRes.ok) return
      throw new Error(`MediaMTX patch path "${name}" failed: ${patchRes.status} ${await safeText(patchRes)}`)
    }

    throw new Error(`MediaMTX add path "${name}" failed: ${addRes.status} ${await safeText(addRes)}`)
  }

  /** Delete a path's config. Idempotent: a 404 (already gone) is success. */
  async removePath(name: string): Promise<void> {
    const res = await this.request('DELETE', `/v3/config/paths/delete/${encodeURIComponent(name)}`)
    if (res.ok || res.status === 404) return
    throw new Error(`MediaMTX remove path "${name}" failed: ${res.status} ${await safeText(res)}`)
  }

  /**
   * Query a path's live state. Returns null when the path is not currently
   * active (404), so callers can treat "not live" distinctly from "error".
   */
  async getPath(name: string): Promise<MediaMtxPathInfo | null> {
    const res = await this.request('GET', `/v3/paths/get/${encodeURIComponent(name)}`)
    if (res.status === 404) return null
    if (!res.ok) {
      throw new Error(`MediaMTX get path "${name}" failed: ${res.status} ${await safeText(res)}`)
    }
    return (await res.json()) as MediaMtxPathInfo
  }

  /** Build CREDENTIAL-FREE playback URLs for the browser. */
  playbackUrls(name: string): { hlsUrl: string; webrtcUrl: string } {
    const enc = encodeURIComponent(name)
    return {
      hlsUrl: `${this.hlsBase}/${enc}/index.m3u8`,
      webrtcUrl: `${this.webrtcBase}/${enc}`,
    }
  }

  /** Liveness check for the control API itself (used by health/diagnostics). */
  async ping(): Promise<boolean> {
    try {
      const res = await this.request('GET', '/v3/paths/list')
      return res.ok
    } catch (error) {
      logger.debug('MediaMTX ping failed', { error: error instanceof Error ? error.message : String(error) })
      return false
    }
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 200)
  } catch {
    return ''
  }
}
