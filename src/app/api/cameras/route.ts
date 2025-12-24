import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, paginatedResponse, handleApiError, parseQueryParams } from '@/lib/utils/api'
import { createCameraSchema } from '@/lib/validators'

// GET /api/cameras - List all cameras
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { page, limit, search } = parseQueryParams(searchParams)
    const parkingLotId = searchParams.get('parkingLotId')
    const zoneId = searchParams.get('zoneId')
    const status = searchParams.get('status')

    const where = {
      ...(parkingLotId && { parkingLotId }),
      ...(zoneId && { zoneId }),
      ...(status && { status: status as any }),
      ...(search && {
        name: { contains: search, mode: 'insensitive' as const },
      }),
    }

    const [cameras, total] = await Promise.all([
      prisma.camera.findMany({
        where,
        include: {
          parkingLot: {
            select: { id: true, name: true },
          },
          zone: {
            select: { id: true, name: true, code: true },
          },
          _count: {
            select: { slots: true, detectionEvents: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.camera.count({ where }),
    ])

    return paginatedResponse(cameras, page, limit, total)
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/cameras - Create a new camera
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = createCameraSchema.parse(body)

    const camera = await prisma.camera.create({
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

    return successResponse(camera, 'Camera created successfully')
  } catch (error) {
    return handleApiError(error)
  }
}
