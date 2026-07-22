import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { verifyIngestToken } from '@/lib/streaming/ingest-token'
import { resolveIngestPath, atomicWrite, removeFile, readFile } from '@/lib/streaming/ingest-store'

/**
 * Edge HLS ingest + playback.
 *
 *   PUT/DELETE /api/edge/ingest/<streamKey>/<file>   ← Edge Agent (Bearer token)
 *   GET        /api/edge/ingest/<streamKey>/<file>   ← browser (credential-free)
 *
 * The Edge Agent's ffmpeg uploads HLS segments over outbound HTTP (works behind
 * NAT/CGNAT). Uploads are authenticated per-camera; playback is credential-free
 * (the security invariant — same as the MediaMTX path). Path traversal is
 * blocked and writes are atomic (readers never see a partial file).
 */

// Extract Bearer token from the Authorization header.
function bearer(request: NextRequest): string | null {
  const h = request.headers.get('authorization')
  if (h?.startsWith('Bearer ')) return h.slice(7)
  return null
}

// Resolve the untrusted [...path] into { streamKey, file }.
function parsePath(parts: string[]): { streamKey: string; file: string } | null {
  if (parts.length < 2) return null
  const streamKey = parts[0]
  const file = parts.slice(1).join('/')
  return { streamKey, file }
}

// Authorize an ingest (write) request: the Bearer token must match the camera
// that owns this stream key AND that camera must be an EDGE_PUSH camera.
async function authorizeIngest(streamKey: string, token: string | null) {
  if (!token) return null
  const camera = await prisma.camera.findFirst({
    where: { mediaMtxPath: streamKey, sourceMode: 'EDGE_PUSH' },
    select: { id: true, ingestTokenHash: true, isActive: true },
  })
  if (!camera || !camera.isActive) return null
  if (!verifyIngestToken(token, camera.ingestTokenHash)) return null
  return camera
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: parts } = await params
  const parsed = parsePath(parts)
  if (!parsed) return NextResponse.json({ error: 'bad path' }, { status: 400 })

  const camera = await authorizeIngest(parsed.streamKey, bearer(request))
  if (!camera) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const resolved = resolveIngestPath(parsed.streamKey, parsed.file)
  if (!resolved.ok) return NextResponse.json({ error: 'bad path' }, { status: 400 })

  try {
    const body = Buffer.from(await request.arrayBuffer())
    await atomicWrite(resolved.full, body)
    return new NextResponse(null, { status: 201 })
  } catch (error) {
    logger.error('edge ingest write failed', error instanceof Error ? error : undefined, {
      cameraId: camera.id,
      file: parsed.file,
    })
    return NextResponse.json({ error: 'write failed' }, { status: 500 })
  }
}

// Some ffmpeg builds POST rather than PUT — accept both for the upload.
export const POST = PUT

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: parts } = await params
  const parsed = parsePath(parts)
  if (!parsed) return NextResponse.json({ error: 'bad path' }, { status: 400 })

  const camera = await authorizeIngest(parsed.streamKey, bearer(request))
  if (!camera) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const resolved = resolveIngestPath(parsed.streamKey, parsed.file)
  if (!resolved.ok) return NextResponse.json({ error: 'bad path' }, { status: 400 })

  await removeFile(resolved.full)
  return new NextResponse(null, { status: 204 })
}

// Browser playback — credential-free. No token required; the playback URL is
// what the app hands out (authorization for WHO gets the URL stays at the app
// layer, same posture as the MediaMTX HLS path).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: parts } = await params
  const parsed = parsePath(parts)
  if (!parsed) return NextResponse.json({ error: 'bad path' }, { status: 400 })

  const resolved = resolveIngestPath(parsed.streamKey, parsed.file)
  if (!resolved.ok) return NextResponse.json({ error: 'bad path' }, { status: 400 })

  const data = await readFile(resolved.full)
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      'Content-Type': resolved.contentType || 'application/octet-stream',
      // Playlists must never be cached; segments are immutable.
      'Cache-Control': parsed.file.endsWith('.m3u8')
        ? 'no-cache, no-store, must-revalidate'
        : 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
