import { NextRequest } from 'next/server'
import { successResponse, handleApiError, errorResponse } from '@/lib/utils/api'
import { getCurrentUser } from '@/lib/auth/session'
import prisma from '@/lib/db'
import { z } from 'zod'

const FEATURE_MATCHING_ENDPOINT = process.env.FEATURE_MATCHING_ENDPOINT || 'http://feature-matching:8000'

// Zod schema for PATCH request validation
const updateImageMetadataSchema = z.object({
  vehicleType: z.string().max(50).optional(),
  vehicleColor: z.string().max(50).optional(),
  licensePlate: z.string().max(20).regex(/^[A-Z0-9\s-]*$/i, 'Invalid license plate format').optional(),
  tokenId: z.string().cuid().optional().nullable(),
}).strict()

interface RouteParams {
  params: Promise<{ id: string; imageId: string }>
}

// GET /api/vehicles/[id]/images/[imageId] - Get a specific image
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, imageId } = await params
    const user = await getCurrentUser()
    if (!user) {
      return errorResponse('Unauthorized', 401)
    }

    const image = await prisma.vehicleFeatureIndex.findFirst({
      where: {
        id: imageId,
        vehicleId: id,
      },
      include: {
        camera: {
          select: {
            id: true,
            name: true,
            parkingLot: {
              select: { id: true, name: true },
            },
          },
        },
        vehicle: {
          select: {
            id: true,
            licensePlate: true,
            vehicleType: true,
            make: true,
            model: true,
            color: true,
          },
        },
        token: {
          select: {
            id: true,
            tokenNumber: true,
            entryTime: true,
            exitTime: true,
            status: true,
          },
        },
      },
    })

    if (!image) {
      return errorResponse('Image not found', 404)
    }

    return successResponse(image)
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/vehicles/[id]/images/[imageId] - Delete an image
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, imageId } = await params
    const user = await getCurrentUser()
    if (!user) {
      return errorResponse('Unauthorized', 401)
    }

    // Only ADMIN can delete images
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return errorResponse('Forbidden', 403)
    }

    // Find the image
    const image = await prisma.vehicleFeatureIndex.findFirst({
      where: {
        id: imageId,
        vehicleId: id,
      },
    })

    if (!image) {
      return errorResponse('Image not found', 404)
    }

    // Delete from feature-matching service (Milvus)
    try {
      await fetch(`${FEATURE_MATCHING_ENDPOINT}/index/${image.milvusId}`, {
        method: 'DELETE',
      })
    } catch (e) {
      // Log but don't fail - Milvus deletion is best effort
      console.warn('Failed to delete from Milvus:', e)
    }

    // Delete from database
    await prisma.vehicleFeatureIndex.delete({
      where: { id: imageId },
    })

    return successResponse({ deleted: imageId }, 'Image deleted successfully')
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/vehicles/[id]/images/[imageId] - Update image metadata
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, imageId } = await params
    const user = await getCurrentUser()
    if (!user) {
      return errorResponse('Unauthorized', 401)
    }

    if (!['ADMIN', 'SUPER_ADMIN', 'OPERATOR'].includes(user.role)) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()

    // Validate request body with Zod
    const validationResult = updateImageMetadataSchema.safeParse(body)
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(i => i.message).join(', ')
      return errorResponse(`Validation error: ${errors}`, 400)
    }

    const { vehicleType, vehicleColor, licensePlate, tokenId } = validationResult.data

    // Verify image exists and belongs to vehicle
    const existing = await prisma.vehicleFeatureIndex.findFirst({
      where: {
        id: imageId,
        vehicleId: id,
      },
    })

    if (!existing) {
      return errorResponse('Image not found', 404)
    }

    // Update metadata
    const updated = await prisma.vehicleFeatureIndex.update({
      where: { id: imageId },
      data: {
        ...(vehicleType !== undefined && { vehicleType }),
        ...(vehicleColor !== undefined && { vehicleColor }),
        ...(licensePlate !== undefined && { licensePlate }),
        ...(tokenId !== undefined && { tokenId }),
      },
      include: {
        camera: {
          select: { id: true, name: true },
        },
        vehicle: {
          select: {
            id: true,
            licensePlate: true,
            vehicleType: true,
          },
        },
      },
    })

    return successResponse(updated, 'Image updated successfully')
  } catch (error) {
    return handleApiError(error)
  }
}
