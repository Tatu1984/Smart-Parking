import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, paginatedResponse, handleApiError, parseQueryParams } from '@/lib/utils/api'
import { createParkingLotSchema } from '@/lib/validators'

// GET /api/parking-lots - List all parking lots
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { page, limit, search, sortBy, sortOrder } = parseQueryParams(searchParams)
    const organizationId = searchParams.get('organizationId')

    const where = {
      ...(organizationId && { organizationId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { city: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }

    const [parkingLots, total] = await Promise.all([
      prisma.parkingLot.findMany({
        where,
        include: {
          _count: {
            select: {
              zones: true,
              cameras: true,
              gates: true,
              tokens: {
                where: { status: 'ACTIVE' },
              },
            },
          },
          zones: {
            include: {
              _count: {
                select: { slots: true },
              },
            },
          },
        },
        orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.parkingLot.count({ where }),
    ])

    // Calculate slot stats for each parking lot
    type SlotStat = { isOccupied: boolean; _count: number }
    const enrichedParkingLots = await Promise.all(
      parkingLots.map(async (lot: typeof parkingLots[number]) => {
        const slotStats = await prisma.slot.groupBy({
          by: ['isOccupied'],
          where: {
            zone: { parkingLotId: lot.id },
            status: { not: 'MAINTENANCE' },
          },
          _count: true,
        })

        const totalSlots = slotStats.reduce((sum: number, stat: SlotStat) => sum + stat._count, 0)
        const occupiedSlots = slotStats.find((s: SlotStat) => s.isOccupied)?._count || 0

        return {
          ...lot,
          totalSlots,
          occupiedSlots,
          availableSlots: totalSlots - occupiedSlots,
          occupancyRate: totalSlots > 0 ? (occupiedSlots / totalSlots) * 100 : 0,
        }
      })
    )

    return paginatedResponse(enrichedParkingLots, page, limit, total)
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/parking-lots - Create a new parking lot
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = createParkingLotSchema.parse(body)

    // For now, use a default organization (in production, get from auth)
    let organization = await prisma.organization.findFirst()
    if (!organization) {
      organization = await prisma.organization.create({
        data: {
          name: 'Default Organization',
          slug: 'default',
        },
      })
    }

    const parkingLot = await prisma.parkingLot.create({
      data: {
        ...data,
        operatingHours: data.operatingHours as object | undefined,
        organizationId: organization.id,
      },
      include: {
        organization: true,
      },
    })

    return successResponse(parkingLot, 'Parking lot created successfully')
  } catch (error) {
    return handleApiError(error)
  }
}
