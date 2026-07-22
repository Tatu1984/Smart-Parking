import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { getAuthUser } from '@/lib/auth/getAuthUser'
import { checkParkingLotAccess } from '@/lib/auth/org-check'

/**
 * GET /api/cameras/[id]/logs
 *
 * Returns the camera's connection log (connect/disconnect/register/error events)
 * written by the health worker and camera CRUD. Org-scoped. Supports ?limit
 * (default 50, max 200).
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
      select: { id: true, parkingLotId: true },
    })
    if (!camera) return errorResponse('Camera not found', 404)

    const allowed = await checkParkingLotAccess(
      { id: user.id, role: user.role, organizationId: user.organizationId },
      camera.parkingLotId
    )
    if (!allowed) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200)

    const logs = await prisma.cameraConnectionLog.findMany({
      where: { cameraId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return successResponse(logs)
  } catch (error) {
    return handleApiError(error)
  }
}
