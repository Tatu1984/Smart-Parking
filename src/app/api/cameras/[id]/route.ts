import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { Prisma } from '@prisma/client'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { updateCameraSchema } from '@/lib/validators'

// GET /api/cameras/[id] - Get a single camera
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    return successResponse(camera)
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
    const { id } = await params
    const body = await request.json()

    // Handle status update separately
    if (body.status) {
      const camera = await prisma.camera.update({
        where: { id },
        data: {
          status: body.status,
          lastPingAt: new Date(),
        },
      })
      return successResponse(camera, 'Camera status updated')
    }

    const data = updateCameraSchema.parse(body)

    const camera = await prisma.camera.update({
      where: { id },
      data,
      include: {
        parkingLot: {
          select: { id: true, name: true },
        },
        zone: {
          select: { id: true, name: true, code: true },
        },
      },
    })

    return successResponse(camera, 'Camera updated successfully')
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
    const { id } = await params

    // Unlink slots from this camera
    await prisma.slot.updateMany({
      where: { cameraId: id },
      data: { cameraId: null, detectionBounds: Prisma.JsonNull },
    })

    await prisma.camera.delete({
      where: { id },
    })

    return successResponse(null, 'Camera deleted successfully')
  } catch (error) {
    return handleApiError(error)
  }
}
