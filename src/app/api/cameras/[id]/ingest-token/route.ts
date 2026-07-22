import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { getAuthUser } from '@/lib/auth/getAuthUser'
import { checkParkingLotAccess } from '@/lib/auth/org-check'
import { generateIngestToken, hashIngestToken } from '@/lib/streaming/ingest-token'
import { logger } from '@/lib/logger'

/**
 * POST /api/cameras/[id]/ingest-token
 *
 * Issues (or rotates) the per-camera ingest Bearer token an Edge Agent uses to
 * upload HLS segments. ADMIN/SUPER_ADMIN only, org-scoped. The plaintext token
 * is returned EXACTLY ONCE; only its keyed hash is stored. Also flips the camera
 * to sourceMode EDGE_PUSH (this camera is now pushed by an on-site agent).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) return errorResponse('Unauthorized', 401)
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params

    const camera = await prisma.camera.findUnique({
      where: { id },
      select: { id: true, name: true, parkingLotId: true, mediaMtxPath: true },
    })
    if (!camera) return errorResponse('Camera not found', 404)

    const allowed = await checkParkingLotAccess(
      { id: user.id, role: user.role, organizationId: user.organizationId },
      camera.parkingLotId
    )
    if (!allowed) return errorResponse('Forbidden', 403)

    const token = generateIngestToken()
    const streamKey = camera.mediaMtxPath || camera.id

    await prisma.camera.update({
      where: { id },
      data: {
        sourceMode: 'EDGE_PUSH',
        ingestTokenHash: hashIngestToken(token),
        // Ensure a stable stream key exists for edge cameras.
        ...(camera.mediaMtxPath ? {} : { mediaMtxPath: streamKey }),
      },
    })

    await prisma.cameraConnectionLog.create({
      data: { cameraId: id, eventType: 'REGISTERED', message: `edge ingest token issued (streamKey: ${streamKey})` },
    })
    logger.info('Edge ingest token issued', { cameraId: id, streamKey })

    // Return the plaintext token ONCE. The agent's config.yaml uses it.
    return successResponse({
      cameraId: id,
      streamKey,
      token,
      // Convenience: the exact ingest URL the agent should PUT to.
      ingestUrl: `/api/edge/ingest/${encodeURIComponent(streamKey)}/index.m3u8`,
      note: 'Store this token now — it will not be shown again.',
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * DELETE /api/cameras/[id]/ingest-token
 *
 * Revokes the ingest token (agent can no longer push). Leaves sourceMode as-is
 * so the operator can re-issue; set the camera back to MEDIAMTX_PULL via the
 * normal camera update if desired.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) return errorResponse('Unauthorized', 401)
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params
    const camera = await prisma.camera.findUnique({
      where: { id },
      select: { id: true, parkingLotId: true },
    })
    if (!camera) return errorResponse('Camera not found', 404)

    const allowed = await checkParkingLotAccess(
      { id: user.id, role: user.role, organizationId: user.organizationId },
      camera.parkingLotId
    )
    if (!allowed) return errorResponse('Forbidden', 403)

    await prisma.camera.update({ where: { id }, data: { ingestTokenHash: null } })
    await prisma.cameraConnectionLog.create({
      data: { cameraId: id, eventType: 'UNREGISTERED', message: 'edge ingest token revoked' },
    })
    logger.info('Edge ingest token revoked', { cameraId: id })

    return successResponse({ cameraId: id, revoked: true })
  } catch (error) {
    return handleApiError(error)
  }
}
