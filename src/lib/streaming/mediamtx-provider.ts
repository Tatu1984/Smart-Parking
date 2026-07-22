/**
 * MediaMtxProvider — the concrete StreamProvider backed by MediaMTX.
 *
 * This is the ONLY place that knows streaming is done with MediaMTX. Business
 * logic depends on the StreamProvider interface, so replacing this with a cloud
 * or clustered implementation later requires no changes upstream.
 */

import { logger } from '@/lib/logger'
import type {
  StreamProvider,
  StreamSource,
  PlaybackUrls,
  StreamHealth,
} from './providers'
import { MediaMtxClient } from './mediamtx-client'
import { buildCredentialedRtspUrl, redactRtspUrl } from './rtsp-url'

export class MediaMtxProvider implements StreamProvider {
  readonly name = 'mediamtx'

  constructor(private readonly client: MediaMtxClient) {}

  async register(source: StreamSource): Promise<void> {
    const rtsp = buildCredentialedRtspUrl({
      rtspUrl: source.rtspUrl,
      username: source.username,
      password: source.password,
    })

    logger.info('Registering camera stream with MediaMTX', {
      key: source.key,
      source: redactRtspUrl(rtsp),
    })

    try {
      await this.client.addOrReplacePath(source.key, rtsp)
      logger.info('MediaMTX path registered', { key: source.key })
    } catch (error) {
      logger.error(
        'MediaMTX path registration failed',
        error instanceof Error ? error : undefined,
        { key: source.key }
      )
      throw error
    }
  }

  async unregister(key: string): Promise<void> {
    try {
      await this.client.removePath(key)
      logger.info('MediaMTX path removed', { key })
    } catch (error) {
      // Best-effort: log but don't throw — camera delete must still succeed.
      logger.warn('MediaMTX path removal failed (continuing)', {
        key,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  playbackUrls(key: string): PlaybackUrls {
    const { hlsUrl, webrtcUrl } = this.client.playbackUrls(key)
    return { key, hlsUrl, webrtcUrl }
  }

  async health(key: string): Promise<StreamHealth> {
    try {
      const info = await this.client.getPath(key)
      if (!info) {
        return { key, ready: false }
      }
      return {
        key,
        ready: info.ready,
        readers: Array.isArray(info.readers) ? info.readers.length : undefined,
        tracks: info.tracks,
        sourceType: info.source?.type,
      }
    } catch (error) {
      logger.debug('MediaMTX health query failed', {
        key,
        error: error instanceof Error ? error.message : String(error),
      })
      return { key, ready: false }
    }
  }
}
