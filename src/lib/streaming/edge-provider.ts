/**
 * EdgeProvider — StreamProvider for EDGE_PUSH cameras.
 *
 * For edge cameras the on-site agent PUSHES HLS to our ingest endpoint, so there
 * is nothing to "register" with a media server. register/unregister are no-ops;
 * playback URLs point at our ingest GET route; health is derived from how fresh
 * the pushed playlist is (a live agent rewrites index.m3u8 every couple seconds).
 *
 * Implements the same StreamProvider interface as MediaMtxProvider, so the
 * health worker, routes, and UI treat edge cameras identically.
 */

import type { StreamProvider, StreamSource, PlaybackUrls, StreamHealth } from './providers'
import { playlistMtime } from './ingest-store'

export class EdgeProvider implements StreamProvider {
  readonly name = 'edge'

  /** Public base the browser uses to reach our ingest GET route. */
  constructor(
    private readonly ingestPublicBase: string,
    /** A stream is "live" if its playlist was written within this window. */
    private readonly freshnessMs = 20000
  ) {}

  // Edge cameras are push-based: nothing to configure server-side. These satisfy
  // the StreamProvider interface but intentionally do nothing.
  async register(source: StreamSource): Promise<void> {
    void source // the agent pushes; token lifecycle is handled by the API route
  }

  async unregister(key: string): Promise<void> {
    void key
  }

  playbackUrls(key: string): PlaybackUrls {
    const base = this.ingestPublicBase.replace(/\/$/, '')
    const enc = encodeURIComponent(key)
    return {
      key,
      // Credential-free HLS served by our ingest GET route.
      hlsUrl: `${base}/api/edge/ingest/${enc}/index.m3u8`,
      // No WebRTC for edge push in this milestone.
      webrtcUrl: '',
    }
  }

  async health(key: string): Promise<StreamHealth> {
    const mtime = await playlistMtime(key)
    if (!mtime) return { key, ready: false }
    const fresh = Date.now() - mtime.getTime() <= this.freshnessMs
    return { key, ready: fresh, sourceType: 'edgePush' }
  }
}
