import { NextRequest } from 'next/server'
import { successResponse, handleApiError, errorResponse, paginatedResponse, parseQueryParams } from '@/lib/utils/api'
import { getCurrentUser } from '@/lib/auth/session'
import prisma from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/vehicles/[id]/images - Get all captured images of a vehicle
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return errorResponse('Unauthorized', 401)
    }

    const { searchParams } = new URL(request.url)
    const { page, limit } = parseQueryParams(searchParams)
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const cameraId = searchParams.get('cameraId')

    // Validate and parse dates
    let startDate: Date | undefined
    let endDate: Date | undefined

    if (startDateStr) {
      startDate = new Date(startDateStr)
      if (isNaN(startDate.getTime())) {
        return errorResponse('Invalid startDate format. Use ISO 8601 format (e.g., 2024-01-01T00:00:00Z)', 400)
      }
    }

    if (endDateStr) {
      endDate = new Date(endDateStr)
      if (isNaN(endDate.getTime())) {
        return errorResponse('Invalid endDate format. Use ISO 8601 format (e.g., 2024-01-01T23:59:59Z)', 400)
      }
    }

    if (startDate && endDate && startDate > endDate) {
      return errorResponse('startDate must be before endDate', 400)
    }

    // Build where clause
    const where: Record<string, unknown> = { vehicleId: id }

    if (startDate || endDate) {
      where.detectedAt = {
        ...(startDate && { gte: startDate }),
        ...(endDate && { lte: endDate }),
      }
    }

    if (cameraId) {
      where.cameraId = cameraId
    }

    // Get vehicle info
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      select: {
        id: true,
        licensePlate: true,
        vehicleType: true,
        make: true,
        model: true,
        color: true,
        isBlacklisted: true,
        isVip: true,
      },
    })

    if (!vehicle) {
      return errorResponse('Vehicle not found', 404)
    }

    // Get images with pagination
    const [images, total] = await Promise.all([
      prisma.vehicleFeatureIndex.findMany({
        where,
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
          token: {
            select: {
              id: true,
              tokenNumber: true,
              entryTime: true,
              status: true,
            },
          },
        },
        orderBy: { detectedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.vehicleFeatureIndex.count({ where }),
    ])

    return successResponse({
      vehicle,
      images,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/vehicles/[id]/images - Link an image to a vehicle
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return errorResponse('Unauthorized', 401)
    }

    // Only ADMIN or OPERATOR can link images
    if (!['ADMIN', 'SUPER_ADMIN', 'OPERATOR'].includes(user.role)) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const { featureIndexId } = body

    if (!featureIndexId) {
      return errorResponse('featureIndexId is required', 400)
    }

    // Verify vehicle exists
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
    })

    if (!vehicle) {
      return errorResponse('Vehicle not found', 404)
    }

    // Update feature index to link to vehicle
    const updated = await prisma.vehicleFeatureIndex.update({
      where: { id: featureIndexId },
      data: { vehicleId: id },
      include: {
        camera: {
          select: { id: true, name: true },
        },
      },
    })

    return successResponse(updated, 'Image linked to vehicle')
  } catch (error) {
    return handleApiError(error)
  }
}
