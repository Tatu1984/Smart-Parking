import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { decrypt } from '@/lib/crypto/encryption'

/**
 * Probe RTSP stream connectivity using FFprobe
 * Updates camera status to ONLINE/OFFLINE based on result
 *
 * POST /api/cameras/[id]/probe
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const camera = await prisma.camera.findUnique({
      where: { id },
    })

    if (!camera) {
      return NextResponse.json({ error: 'Camera not found' }, { status: 404 })
    }

    if (!camera.rtspUrl) {
      return NextResponse.json({ error: 'No RTSP URL configured' }, { status: 400 })
    }

    // Build RTSP URL with decrypted credentials if stored separately
    let rtspUrl = camera.rtspUrl
    if (camera.username && camera.password) {
      try {
        const decryptedUser = decrypt(camera.username)
        const decryptedPass = decrypt(camera.password)
        if (!camera.rtspUrl.includes('@') || camera.rtspUrl.indexOf('@') > camera.rtspUrl.indexOf('//') + 2) {
          const urlObj = new URL(camera.rtspUrl)
          urlObj.username = decryptedUser
          urlObj.password = decryptedPass
          rtspUrl = urlObj.toString()
        }
      } catch {
        // URL may already contain credentials
      }
    }

    // Probe the RTSP stream using ffprobe
    const probeResult = await probeRtspStream(rtspUrl)

    // Update camera status in DB
    const newStatus = probeResult.success ? 'ONLINE' : 'OFFLINE'
    const updated = await prisma.camera.update({
      where: { id },
      data: {
        status: newStatus,
        lastPingAt: new Date(),
        ...(probeResult.resolution && { resolution: probeResult.resolution }),
        ...(probeResult.fps && { fps: probeResult.fps }),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        status: newStatus,
        resolution: probeResult.resolution,
        fps: probeResult.fps,
        codec: probeResult.codec,
        message: probeResult.success
          ? 'Camera is reachable and streaming'
          : probeResult.error || 'Camera is not reachable',
      },
    })
  } catch (error) {
    logger.error('Probe error:', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to probe camera' },
      { status: 500 }
    )
  }
}

interface ProbeResult {
  success: boolean
  resolution?: string
  fps?: number
  codec?: string
  error?: string
}

function probeRtspStream(rtspUrl: string): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []

    const ffprobe = spawn('ffprobe', [
      '-rtsp_transport', 'tcp',
      '-v', 'error',
      '-show_entries', 'stream=width,height,r_frame_rate,codec_name',
      '-of', 'json',
      '-timeout', '5000000',  // 5 second timeout in microseconds
      rtspUrl,
    ])

    const timeout = setTimeout(() => {
      ffprobe.kill('SIGTERM')
      resolve({ success: false, error: 'Connection timed out (5s)' })
    }, 8000)

    ffprobe.stdout.on('data', (data: Buffer) => {
      chunks.push(data)
    })

    ffprobe.stderr.on('data', (data: Buffer) => {
      errChunks.push(data)
    })

    ffprobe.on('close', (code) => {
      clearTimeout(timeout)

      if (code === 0 && chunks.length > 0) {
        try {
          const output = JSON.parse(Buffer.concat(chunks).toString())
          const stream = output.streams?.[0]

          if (stream) {
            const fps = stream.r_frame_rate
              ? eval(stream.r_frame_rate) // e.g., "25/1" → 25
              : undefined

            resolve({
              success: true,
              resolution: stream.width && stream.height
                ? `${stream.width}x${stream.height}`
                : undefined,
              fps: typeof fps === 'number' && isFinite(fps) ? Math.round(fps) : undefined,
              codec: stream.codec_name,
            })
          } else {
            resolve({ success: true })
          }
        } catch {
          resolve({ success: true })
        }
      } else {
        const errOutput = Buffer.concat(errChunks).toString().trim()
        resolve({
          success: false,
          error: errOutput.slice(0, 200) || `FFprobe exited with code ${code}`,
        })
      }
    })

    ffprobe.on('error', (error) => {
      clearTimeout(timeout)
      resolve({
        success: false,
        error: error.message.includes('ENOENT')
          ? 'FFmpeg/FFprobe not installed on server'
          : error.message,
      })
    })
  })
}
