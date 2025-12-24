import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, paginatedResponse, handleApiError, parseQueryParams } from '@/lib/utils/api'
import { createZoneSchema } from '@/lib/validators'

// GET /api/zones - List all zones
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { page, limit, search } = parseQueryParams(searchParams)
    const parkingLotId = searchParams.get('parkingLotId')

    const where = {
      ...(parkingLotId && { parkingLotId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { code: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }

    const [zones, total] = await Promise.all([
      prisma.zone.findMany({
        where,
        include: {
          parkingLot: {
            select: { id: true, name: true },
          },
          slots: {
            select: {
              id: true,
              slotNumber: true,
              isOccupied: true,
              status: true,
            },
          },
          _count: {
            select: { slots: true, cameras: true },
          },
        },
        orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.zone.count({ where }),
    ])

    // Calculate occupancy for each zone
    type SlotData = { isOccupied: boolean; status: string }
    const enrichedZones = zones.map((zone: typeof zones[number]) => {
      const totalSlots = zone.slots.length
      const occupiedSlots = zone.slots.filter((s: SlotData) => s.isOccupied).length
      const availableSlots = zone.slots.filter(
        (s: SlotData) => !s.isOccupied && s.status !== 'MAINTENANCE' && s.status !== 'BLOCKED'
      ).length

      return {
        ...zone,
        slots: undefined, // Remove individual slots from list response
        totalSlots,
        occupiedSlots,
        availableSlots,
        occupancyRate: totalSlots > 0 ? (occupiedSlots / totalSlots) * 100 : 0,
      }
    })

    return paginatedResponse(enrichedZones, page, limit, total)
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/zones - Create a new zone
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = createZoneSchema.parse(body)

    const zone = await prisma.zone.create({
      data,
      include: {
        parkingLot: {
          select: { id: true, name: true },
        },
      },
    })

    // Update parking lot totalSlots count
    await updateParkingLotSlotCount(data.parkingLotId)

    return successResponse(zone, 'Zone created successfully')
  } catch (error) {
    return handleApiError(error)
  }
}

async function updateParkingLotSlotCount(parkingLotId: string) {
  const count = await prisma.slot.count({
    where: { zone: { parkingLotId } },
  })
  await prisma.parkingLot.update({
    where: { id: parkingLotId },
    data: { totalSlots: count },
  })
}
