import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logger } from '@/lib/logger'

/**
 * Camera Snapshot API
 * Captures a single frame from RTSP stream
 *
 * Usage: GET /api/cameras/[id]/snapshot
 * Returns: JPEG image
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get camera details
    const camera = await prisma.camera.findUnique({
      where: { id }
    })

    if (!camera) {
      return NextResponse.json({ error: 'Camera not found' }, { status: 404 })
    }

    if (!camera.rtspUrl) {
      return NextResponse.json({ error: 'No RTSP URL configured' }, { status: 400 })
    }

    // Build RTSP URL with credentials if provided
    let rtspUrl = camera.rtspUrl
    if (camera.username && camera.password) {
      const url = new URL(camera.rtspUrl)
      url.username = camera.username
      url.password = camera.password
      rtspUrl = url.toString()
    }

    // Capture single frame using FFmpeg
    const snapshot = await captureSnapshot(rtspUrl)

    if (!snapshot) {
      return NextResponse.json(
        { error: 'Failed to capture snapshot' },
        { status: 500 }
      )
    }

    return new NextResponse(new Uint8Array(snapshot), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Length': snapshot.length.toString()
      }
    })
  } catch (error) {
    logger.error('Snapshot error:', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to capture snapshot' },
      { status: 500 }
    )
  }
}

function captureSnapshot(rtspUrl: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []

    const ffmpeg = spawn('ffmpeg', [
      '-rtsp_transport', 'tcp',
      '-i', rtspUrl,
      '-frames:v', '1',         // Capture only 1 frame
      '-f', 'image2',
      '-q:v', '2',              // High quality
      '-'                       // Output to stdout
    ])

    // Set timeout for snapshot capture
    const timeout = setTimeout(() => {
      ffmpeg.kill('SIGTERM')
      resolve(null)
    }, 10000) // 10 second timeout

    ffmpeg.stdout.on('data', (data: Buffer) => {
      chunks.push(data)
    })

    ffmpeg.stderr.on('data', (data: Buffer) => {
      // FFmpeg outputs info to stderr, ignore unless debugging
      logger.debug(`FFmpeg snapshot: ${data.toString().slice(0, 100)}`)
    })

    ffmpeg.on('close', (code) => {
      clearTimeout(timeout)
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks))
      } else {
        resolve(null)
      }
    })

    ffmpeg.on('error', (error) => {
      clearTimeout(timeout)
      logger.error('FFmpeg snapshot error:', error instanceof Error ? error : undefined)
      resolve(null)
    })
  })
}
