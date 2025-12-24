import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { updateZoneSchema } from '@/lib/validators'

// GET /api/zones/[id] - Get a single zone with all slots
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const zone = await prisma.zone.findUnique({
      where: { id },
      include: {
        parkingLot: {
          select: { id: true, name: true, slug: true },
        },
        slots: {
          orderBy: { slotNumber: 'asc' },
          include: {
            camera: {
              select: { id: true, name: true },
            },
          },
        },
        cameras: {
          select: {
            id: true,
            name: true,
            status: true,
            rtspUrl: true,
          },
        },
      },
    })

    if (!zone) {
      return errorResponse('Zone not found', 404)
    }

    // Calculate stats
    type SlotData = { isOccupied: boolean; status: string }
    const totalSlots = zone.slots.length
    const occupiedSlots = zone.slots.filter((s: SlotData) => s.isOccupied).length
    const availableSlots = zone.slots.filter(
      (s: SlotData) => !s.isOccupied && s.status !== 'MAINTENANCE' && s.status !== 'BLOCKED'
    ).length
    const maintenanceSlots = zone.slots.filter((s: SlotData) => s.status === 'MAINTENANCE').length

    return successResponse({
      ...zone,
      stats: {
        totalSlots,
        occupiedSlots,
        availableSlots,
        maintenanceSlots,
        occupancyRate: totalSlots > 0 ? (occupiedSlots / totalSlots) * 100 : 0,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/zones/[id] - Update a zone
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const data = updateZoneSchema.parse(body)

    const zone = await prisma.zone.update({
      where: { id },
      data,
      include: {
        parkingLot: {
          select: { id: true, name: true },
        },
      },
    })

    return successResponse(zone, 'Zone updated successfully')
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/zones/[id] - Delete a zone
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const zone = await prisma.zone.findUnique({
      where: { id },
      select: { parkingLotId: true },
    })

    if (!zone) {
      return errorResponse('Zone not found', 404)
    }

    await prisma.zone.delete({
      where: { id },
    })

    // Update parking lot slot count
    const count = await prisma.slot.count({
      where: { zone: { parkingLotId: zone.parkingLotId } },
    })
    await prisma.parkingLot.update({
      where: { id: zone.parkingLotId },
      data: { totalSlots: count },
    })

    return successResponse(null, 'Zone deleted successfully')
  } catch (error) {
    return handleApiError(error)
  }
}
