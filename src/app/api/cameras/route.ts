import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, paginatedResponse, handleApiError, parseQueryParams } from '@/lib/utils/api'
import { createCameraSchema } from '@/lib/validators'
import { getCurrentUser } from '@/lib/auth/session'
import { encrypt } from '@/lib/crypto/encryption'

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
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN or SUPER_ADMIN can create cameras
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const data = createCameraSchema.parse(body)

    // Encrypt sensitive credentials before storing
    const encryptedData = {
      ...data,
      username: data.username ? encrypt(data.username) : null,
      password: data.password ? encrypt(data.password) : null,
    }

    const camera = await prisma.camera.create({
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

    return successResponse(response, 'Camera created successfully')
  } catch (error) {
    return handleApiError(error)
  }
}
