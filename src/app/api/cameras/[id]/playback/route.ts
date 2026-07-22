import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { getAuthUser } from '@/lib/auth/getAuthUser'
import { checkParkingLotAccess } from '@/lib/auth/org-check'
import { cameraPlaybackUrls, registerCameraStream, streamKeyFor } from '@/lib/streaming'
import { logger } from '@/lib/logger'

/**
 * GET /api/cameras/[id]/playback
 *
 * Returns CREDENTIAL-FREE playback URLs (HLS primary, WebRTC optional) for a
 * camera. Ensures the media-server path is registered first so playback works
 * even if the camera was created while the media server was down. RTSP
 * credentials NEVER appear in the response — the security invariant of the
 * CCTV module.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) return errorResponse('Unauthorized', 401)

    const { id } = await params

    const camera = await prisma.camera.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        isActive: true,
        rtspUrl: true,
        username: true,
        password: true,
        mediaMtxPath: true,
        sourceMode: true,
        parkingLotId: true,
        zoneId: true,
      },
    })

    if (!camera) return errorResponse('Camera not found', 404)

    // Tenant isolation: the camera's parking lot must belong to the user's org.
    const allowed = await checkParkingLotAccess(
      { id: user.id, role: user.role, organizationId: user.organizationId },
      camera.parkingLotId
    )
    if (!allowed) return errorResponse('Forbidden', 403)

    // Ensure the media-server path exists (idempotent). Best-effort: if the
    // media server is unreachable we still return the URLs — the browser player
    // will retry, and the health worker will reconcile status.
    // Only pull-mode cameras need a media-server registration; edge-push cameras
    // are fed by the on-site agent, so there is nothing to register here.
    if (camera.sourceMode !== 'EDGE_PUSH') {
      try {
        await registerCameraStream({
          id: camera.id,
          name: camera.name,
          rtspUrl: camera.rtspUrl,
          username: camera.username,
          password: camera.password,
          mediaMtxPath: camera.mediaMtxPath,
          sourceMode: camera.sourceMode,
          parkingLotId: camera.parkingLotId,
          zoneId: camera.zoneId,
        })
      } catch (streamErr) {
        logger.warn('playback: stream (re)registration failed', {
          cameraId: camera.id,
          error: streamErr instanceof Error ? streamErr.message : String(streamErr),
        })
      }
    }

    const urls = cameraPlaybackUrls(camera)

    return successResponse({
      cameraId: camera.id,
      path: streamKeyFor(camera),
      status: camera.status,
      // Credential-free playback URLs — safe to hand to the browser.
      hlsUrl: urls.hlsUrl,
      webrtcUrl: urls.webrtcUrl,
      // HLS is the primary/default transport; WebRTC is an optional low-latency mode.
      primary: 'hls' as const,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
