import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { updateSlotSchema } from '@/lib/validators'

// GET /api/slots/[id] - Get a single slot
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const slot = await prisma.slot.findUnique({
      where: { id },
      include: {
        zone: {
          include: {
            parkingLot: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        camera: {
          select: { id: true, name: true, status: true, rtspUrl: true },
        },
        occupancies: {
          take: 10,
          orderBy: { startTime: 'desc' },
          include: {
            token: {
              select: { id: true, tokenNumber: true, licensePlate: true },
            },
            vehicle: {
              select: { id: true, licensePlate: true, vehicleType: true },
            },
          },
        },
        tokenAllocations: {
          where: { status: 'ACTIVE' },
          take: 1,
          include: {
            vehicle: true,
          },
        },
      },
    })

    if (!slot) {
      return errorResponse('Slot not found', 404)
    }

    return successResponse(slot)
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/slots/[id] - Update a slot
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN, SUPER_ADMIN, or OPERATOR can modify slots
    if (!['ADMIN', 'SUPER_ADMIN', 'OPERATOR'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const data = updateSlotSchema.parse(body)

    const slot = await prisma.slot.update({
      where: { id },
      data: {
        ...data,
        ...(data.isOccupied !== undefined && {
          lastDetectedAt: new Date(),
        }),
      },
      include: {
        zone: {
          select: { id: true, name: true, code: true },
        },
      },
    })

    return successResponse(slot, 'Slot updated successfully')
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/slots/[id] - Delete a slot
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN or SUPER_ADMIN can delete slots
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const slot = await prisma.slot.findUnique({
      where: { id },
      select: { zone: { select: { parkingLotId: true } } },
    })

    if (!slot) {
      return errorResponse('Slot not found', 404)
    }

    // Use transaction to ensure consistency
    await prisma.$transaction(async (tx) => {
      await tx.slot.delete({
        where: { id },
      })

      // Update parking lot slot count
      const count = await tx.slot.count({
        where: { zone: { parkingLotId: slot.zone.parkingLotId } },
      })
      await tx.parkingLot.update({
        where: { id: slot.zone.parkingLotId },
        data: { totalSlots: count },
      })
    })

    return successResponse(null, 'Slot deleted successfully')
  } catch (error) {
    return handleApiError(error)
  }
}
