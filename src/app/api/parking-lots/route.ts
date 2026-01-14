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

    // Use a single optimized query with aggregation to avoid N+1
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
              slots: {
                select: {
                  isOccupied: true,
                  status: true
                }
              }
            },
          },
        },
        orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.parkingLot.count({ where }),
    ])

    // Calculate slot stats from the already-fetched zones data (no N+1)
    const enrichedParkingLots = parkingLots.map((lot) => {
      // Calculate stats from zones already included in the query
      let totalSlots = 0
      let occupiedSlots = 0
      let maintenanceSlots = 0

      for (const zone of lot.zones) {
        totalSlots += zone._count.slots
        for (const slot of zone.slots) {
          if (slot.isOccupied) occupiedSlots++
          if (slot.status === 'MAINTENANCE') maintenanceSlots++
        }
      }

      const availableSlots = totalSlots - occupiedSlots - maintenanceSlots

      // Remove the slots array from zones to reduce response size
      const zonesWithoutSlots = lot.zones.map(z => ({
        id: z.id,
        name: z.name,
        code: z.code,
        level: z.level,
        zoneType: z.zoneType,
        status: z.status,
        _count: z._count
      }))

      return {
        ...lot,
        zones: zonesWithoutSlots,
        totalSlots,
        occupiedSlots,
        availableSlots,
        occupancyRate: totalSlots > 0 ? (occupiedSlots / totalSlots) * 100 : 0,
      }
    })

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
