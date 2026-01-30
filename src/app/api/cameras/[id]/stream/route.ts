import { NextRequest, NextResponse } from 'next/server'
import { spawn, ChildProcess } from 'child_process'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logger } from '@/lib/logger'

// Store active FFmpeg processes
const activeStreams = new Map<string, ChildProcess>()

/**
 * MJPEG Stream Proxy
 * Converts RTSP stream to MJPEG for browser viewing
 *
 * Usage: GET /api/cameras/[id]/stream
 * Returns: multipart/x-mixed-replace MJPEG stream
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

    // Create a ReadableStream for MJPEG output
    const stream = new ReadableStream({
      start(controller) {
        // FFmpeg command to convert RTSP to MJPEG
        const ffmpeg = spawn('ffmpeg', [
          '-rtsp_transport', 'tcp',
          '-i', rtspUrl,
          '-f', 'mjpeg',
          '-q:v', '5',           // Quality (2-31, lower is better)
          '-r', '15',            // Frame rate
          '-s', '640x480',       // Resolution
          '-an',                 // No audio
          '-'                    // Output to stdout
        ])

        activeStreams.set(id, ffmpeg)

        // MJPEG boundary
        const boundary = '--mjpegboundary'
        let frameBuffer = Buffer.alloc(0)
        let inFrame = false

        ffmpeg.stdout.on('data', (data: Buffer) => {
          // Look for JPEG markers
          for (let i = 0; i < data.length; i++) {
            if (data[i] === 0xFF && data[i + 1] === 0xD8) {
              // Start of JPEG (SOI marker)
              inFrame = true
              frameBuffer = Buffer.from([0xFF, 0xD8])
              i++ // Skip next byte
            } else if (data[i] === 0xFF && data[i + 1] === 0xD9 && inFrame) {
              // End of JPEG (EOI marker)
              frameBuffer = Buffer.concat([frameBuffer, Buffer.from([0xFF, 0xD9])])

              // Send frame with MJPEG headers
              const header = `${boundary}\r\nContent-Type: image/jpeg\r\nContent-Length: ${frameBuffer.length}\r\n\r\n`
              controller.enqueue(new TextEncoder().encode(header))
              controller.enqueue(frameBuffer)
              controller.enqueue(new TextEncoder().encode('\r\n'))

              inFrame = false
              frameBuffer = Buffer.alloc(0)
              i++ // Skip next byte
            } else if (inFrame) {
              frameBuffer = Buffer.concat([frameBuffer, Buffer.from([data[i]])])
            }
          }
        })

        ffmpeg.stderr.on('data', (data: Buffer) => {
          // FFmpeg outputs info to stderr, log for debugging
          logger.debug(`FFmpeg [${id}]: ${data.toString()}`)
        })

        ffmpeg.on('close', (code) => {
          logger.info(`FFmpeg stream closed for camera ${id} with code ${code}`)
          activeStreams.delete(id)
          controller.close()
        })

        ffmpeg.on('error', (error) => {
          logger.error(`FFmpeg error for camera ${id}:`, error instanceof Error ? error : undefined)
          activeStreams.delete(id)
          controller.error(error)
        })

        // Handle client disconnect
        request.signal.addEventListener('abort', () => {
          logger.info(`Client disconnected from camera ${id}`)
          ffmpeg.kill('SIGTERM')
          activeStreams.delete(id)
        })
      },

      cancel() {
        const ffmpeg = activeStreams.get(id)
        if (ffmpeg) {
          ffmpeg.kill('SIGTERM')
          activeStreams.delete(id)
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'multipart/x-mixed-replace; boundary=--mjpegboundary',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Connection': 'keep-alive'
      }
    })
  } catch (error) {
    logger.error('Stream error:', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to start stream' },
      { status: 500 }
    )
  }
}

/**
 * Stop stream
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const ffmpeg = activeStreams.get(id)

    if (ffmpeg) {
      ffmpeg.kill('SIGTERM')
      activeStreams.delete(id)
      return NextResponse.json({ message: 'Stream stopped' })
    }

    return NextResponse.json({ message: 'No active stream' })
  } catch (error) {
    logger.error('Stop stream error:', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to stop stream' },
      { status: 500 }
    )
  }
}
