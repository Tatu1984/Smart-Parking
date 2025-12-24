import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, paginatedResponse, handleApiError, parseQueryParams } from '@/lib/utils/api'
import { z } from 'zod'

const createVehicleSchema = z.object({
  licensePlate: z.string().min(1).max(20),
  vehicleType: z.enum(['CAR', 'SUV', 'MOTORCYCLE', 'BUS', 'TRUCK', 'VAN', 'BICYCLE', 'ANY']).default('CAR'),
  make: z.string().optional(),
  model: z.string().optional(),
  color: z.string().optional(),
  ownerName: z.string().optional(),
  ownerPhone: z.string().optional(),
  ownerEmail: z.string().email().optional(),
  isBlacklisted: z.boolean().default(false),
  isWhitelisted: z.boolean().default(false),
  isVip: z.boolean().default(false),
  membershipId: z.string().optional(),
})

// GET /api/vehicles - List all vehicles
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { page, limit, search } = parseQueryParams(searchParams)
    const isBlacklisted = searchParams.get('isBlacklisted')
    const isWhitelisted = searchParams.get('isWhitelisted')
    const isVip = searchParams.get('isVip')

    const where = {
      ...(isBlacklisted !== null && { isBlacklisted: isBlacklisted === 'true' }),
      ...(isWhitelisted !== null && { isWhitelisted: isWhitelisted === 'true' }),
      ...(isVip !== null && { isVip: isVip === 'true' }),
      ...(search && {
        OR: [
          { licensePlate: { contains: search, mode: 'insensitive' as const } },
          { ownerName: { contains: search, mode: 'insensitive' as const } },
          { ownerPhone: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        include: {
          _count: {
            select: { tokens: true },
          },
        },
        orderBy: { lastVisitAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.vehicle.count({ where }),
    ])

    return paginatedResponse(vehicles, page, limit, total)
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/vehicles - Create a new vehicle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = createVehicleSchema.parse(body)

    const vehicle = await prisma.vehicle.create({
      data: {
        ...data,
        licensePlate: data.licensePlate.toUpperCase(),
      },
    })

    return successResponse(vehicle, 'Vehicle created successfully')
  } catch (error) {
    return handleApiError(error)
  }
}
