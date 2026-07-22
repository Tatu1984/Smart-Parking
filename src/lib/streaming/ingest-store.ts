/**
 * Local-filesystem store for Edge-pushed HLS segments.
 *
 * Segments are namespaced per stream key. Two invariants matter for safety:
 *  1. Path-traversal guard — an uploaded filename can never escape the stream's
 *     own directory (no `../`, no absolute paths, no leaking into other streams).
 *  2. Atomic writes — write to a temp file then rename, so a browser GET never
 *     reads a half-written segment/playlist.
 *
 * Storage backend is intentionally simple (local disk) for this milestone;
 * object storage (S3/Azure) is a later scale step and would implement the same
 * small surface (put/remove/read/path).
 */

import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

/** Root dir for ingested HLS. Configurable; defaults under the OS temp dir. */
export function ingestRoot(): string {
  return process.env.EDGE_INGEST_DIR || path.join(process.cwd(), '.edge-hls')
}

/** Allowed HLS file extensions the agent may upload/serve. */
const ALLOWED_EXT = new Set(['.m3u8', '.ts', '.mp4', '.m4s'])

export interface ResolvedPath {
  ok: boolean
  full: string
  contentType?: string
}

/**
 * Resolve `<streamKey>/<file>` to an absolute path inside the stream's dir,
 * rejecting traversal and disallowed extensions. `streamKey` and `file` come
 * straight from the URL and are UNTRUSTED.
 */
export function resolveIngestPath(streamKey: string, file: string): ResolvedPath {
  // Reject anything that isn't a plain segment/playlist name.
  const base = path.basename(file)
  if (base !== file || base.startsWith('.')) {
    return { ok: false, full: '' }
  }
  const ext = path.extname(base).toLowerCase()
  if (!ALLOWED_EXT.has(ext)) {
    return { ok: false, full: '' }
  }

  // streamKey must be a single, safe path segment (no separators / traversal).
  const safeKey = path.basename(streamKey)
  if (safeKey !== streamKey || safeKey.startsWith('.')) {
    return { ok: false, full: '' }
  }

  const root = path.resolve(ingestRoot())
  const streamDir = path.resolve(root, safeKey)
  const full = path.resolve(streamDir, base)

  // Defense in depth: the resolved path must stay within the stream's dir.
  if (full !== streamDir && !full.startsWith(streamDir + path.sep)) {
    return { ok: false, full: '' }
  }

  return { ok: true, full, contentType: contentTypeFor(ext) }
}

function contentTypeFor(ext: string): string {
  switch (ext) {
    case '.m3u8':
      return 'application/vnd.apple.mpegurl'
    case '.ts':
      return 'video/mp2t'
    case '.mp4':
    case '.m4s':
      return 'video/mp4'
    default:
      return 'application/octet-stream'
  }
}

/** Atomically write bytes to `full` (temp file + rename). Creates parent dir. */
export async function atomicWrite(full: string, data: Buffer): Promise<void> {
  await fs.mkdir(path.dirname(full), { recursive: true })
  const tmp = `${full}.${crypto.randomBytes(6).toString('hex')}.tmp`
  try {
    await fs.writeFile(tmp, data)
    await fs.rename(tmp, full)
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => {})
    throw err
  }
}

/** Remove a segment (ffmpeg deletes old ones). Missing file is not an error. */
export async function removeFile(full: string): Promise<void> {
  await fs.rm(full, { force: true })
}

/** Read a file for serving. Returns null if it doesn't exist. */
export async function readFile(full: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(full)
  } catch {
    return null
  }
}

/**
 * Freshness of a stream: mtime of its playlist. Used by EdgeProvider.health to
 * decide if the agent is currently pushing (recent) or gone (stale).
 */
export async function playlistMtime(streamKey: string): Promise<Date | null> {
  const resolved = resolveIngestPath(streamKey, 'index.m3u8')
  if (!resolved.ok) return null
  try {
    const stat = await fs.stat(resolved.full)
    return stat.mtime
  } catch {
    return null
  }
}
