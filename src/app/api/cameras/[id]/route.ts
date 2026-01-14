import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth/session'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { updateCameraSchema } from '@/lib/validators'
import { encrypt, decrypt } from '@/lib/crypto/encryption'

// GET /api/cameras/[id] - Get a single camera
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const camera = await prisma.camera.findUnique({
      where: { id },
      include: {
        parkingLot: {
          select: { id: true, name: true, slug: true },
        },
        zone: {
          select: { id: true, name: true, code: true, level: true },
        },
        slots: {
          select: {
            id: true,
            slotNumber: true,
            isOccupied: true,
            status: true,
            detectionBounds: true,
          },
          orderBy: { slotNumber: 'asc' },
        },
        detectionEvents: {
          take: 50,
          orderBy: { timestamp: 'desc' },
        },
      },
    })

    if (!camera) {
      return errorResponse('Camera not found', 404)
    }

    // Handle credentials based on user role
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role)

    const response = { ...camera } as Record<string, unknown>
    if (isAdmin) {
      // Decrypt credentials for admins
      response.username = camera.username ? decrypt(camera.username) : null
      response.password = camera.password ? decrypt(camera.password) : null
    } else {
      // Mask credentials for non-admins
      response.username = camera.username ? '***' : null
      response.password = camera.password ? '***' : null
      response.onvifUrl = camera.onvifUrl ? '***' : null
    }

    return successResponse(response)
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/cameras/[id] - Update a camera
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN, SUPER_ADMIN, or OPERATOR can modify cameras
    if (!['ADMIN', 'SUPER_ADMIN', 'OPERATOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    // Handle status update separately (for heartbeat updates)
    if (body.status && Object.keys(body).length === 1) {
      const camera = await prisma.camera.update({
        where: { id },
        data: {
          status: body.status,
          lastPingAt: new Date(),
        },
      })
      return successResponse(camera, 'Camera status updated')
    }

    // Only admins can update credentials
    if ((body.username || body.password || body.rtspUrl || body.onvifUrl) &&
        !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Only admins can update camera credentials' },
        { status: 403 }
      )
    }

    const data = updateCameraSchema.parse(body)

    // Encrypt sensitive credentials before updating
    const encryptedData = {
      ...data,
      ...(data.username !== undefined && { username: data.username ? encrypt(data.username) : null }),
      ...(data.password !== undefined && { password: data.password ? encrypt(data.password) : null }),
    }

    const camera = await prisma.camera.update({
      where: { id },
      data: encryptedData,
      include: {
        parkingLot: {
          select: { id: true, name: true },
        },
        zone: {
          select: { id: true, name: true, code: true },
        },
      },
    })

    // Mask credentials in response
    const response = {
      ...camera,
      username: camera.username ? '***' : null,
      password: camera.password ? '***' : null,
    }

    return successResponse(response, 'Camera updated successfully')
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/cameras/[id] - Delete a camera
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN or SUPER_ADMIN can delete cameras
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Check if camera exists
    const camera = await prisma.camera.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!camera) {
      return errorResponse('Camera not found', 404)
    }

    // Use transaction to ensure consistency
    await prisma.$transaction(async (tx) => {
      // Unlink slots from this camera
      await tx.slot.updateMany({
        where: { cameraId: id },
        data: { cameraId: null, detectionBounds: Prisma.JsonNull },
      })

      await tx.camera.delete({
        where: { id },
      })
    })

    return successResponse(null, 'Camera deleted successfully')
  } catch (error) {
    return handleApiError(error)
  }
}
