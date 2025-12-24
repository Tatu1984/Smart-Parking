import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, paginatedResponse, handleApiError, parseQueryParams } from '@/lib/utils/api'
import { createSlotSchema, bulkCreateSlotsSchema } from '@/lib/validators'

// GET /api/slots - List all slots
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { page, limit, search } = parseQueryParams(searchParams)
    const zoneId = searchParams.get('zoneId')
    const parkingLotId = searchParams.get('parkingLotId')
    const status = searchParams.get('status')
    const isOccupied = searchParams.get('isOccupied')

    const where = {
      ...(zoneId && { zoneId }),
      ...(parkingLotId && { zone: { parkingLotId } }),
      ...(status && { status: status as any }),
      ...(isOccupied !== null && { isOccupied: isOccupied === 'true' }),
      ...(search && {
        slotNumber: { contains: search, mode: 'insensitive' as const },
      }),
    }

    const [slots, total] = await Promise.all([
      prisma.slot.findMany({
        where,
        include: {
          zone: {
            select: {
              id: true,
              name: true,
              code: true,
              level: true,
              parkingLot: {
                select: { id: true, name: true },
              },
            },
          },
          camera: {
            select: { id: true, name: true, status: true },
          },
        },
        orderBy: { slotNumber: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.slot.count({ where }),
    ])

    return paginatedResponse(slots, page, limit, total)
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/slots - Create a single slot or bulk create
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Check if bulk creation
    if (body.count) {
      const data = bulkCreateSlotsSchema.parse(body)

      const zone = await prisma.zone.findUnique({
        where: { id: data.zoneId },
        select: { parkingLotId: true },
      })

      if (!zone) {
        return handleApiError(new Error('Zone not found'))
      }

      const slots = []
      for (let i = 0; i < data.count; i++) {
        const slotNumber = `${data.prefix}-${String(data.startNumber + i).padStart(3, '0')}`
        slots.push({
          zoneId: data.zoneId,
          slotNumber,
          slotType: data.slotType,
          vehicleType: data.vehicleType,
          positionX: (i % 10) * 60,
          positionY: Math.floor(i / 10) * 120,
        })
      }

      const created = await prisma.slot.createMany({
        data: slots,
        skipDuplicates: true,
      })

      // Update parking lot slot count
      await updateParkingLotSlotCount(zone.parkingLotId)

      return successResponse(
        { count: created.count },
        `${created.count} slots created successfully`
      )
    }

    // Single slot creation
    const data = createSlotSchema.parse(body)

    const zone = await prisma.zone.findUnique({
      where: { id: data.zoneId },
      select: { parkingLotId: true },
    })

    if (!zone) {
      return handleApiError(new Error('Zone not found'))
    }

    const slot = await prisma.slot.create({
      data,
      include: {
        zone: {
          select: { id: true, name: true, code: true },
        },
      },
    })

    // Update parking lot slot count
    await updateParkingLotSlotCount(zone.parkingLotId)

    return successResponse(slot, 'Slot created successfully')
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
