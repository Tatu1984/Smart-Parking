import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { updateParkingLotSchema } from '@/lib/validators'
import { getCurrentUser } from '@/lib/auth/session'

// GET /api/parking-lots/[id] - Get a single parking lot
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

    const parkingLot = await prisma.parkingLot.findUnique({
      where: { id },
      include: {
        organization: true,
        zones: {
          include: {
            slots: {
              orderBy: { slotNumber: 'asc' },
            },
            cameras: true,
            _count: {
              select: { slots: true },
            },
          },
          orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
        },
        cameras: {
          include: {
            zone: true,
          },
        },
        gates: true,
        displays: true,
        pricingRules: {
          where: { isActive: true },
          orderBy: { priority: 'desc' },
        },
      },
    })

    if (!parkingLot) {
      return errorResponse('Parking lot not found', 404)
    }

    // Calculate slot statistics
    const slotStats = await prisma.slot.groupBy({
      by: ['status', 'isOccupied'],
      where: {
        zone: { parkingLotId: id },
      },
      _count: true,
    })

    type SlotStat = { status: string; isOccupied: boolean; _count: number }
    const totalSlots = slotStats.reduce((sum: number, stat: SlotStat) => sum + stat._count, 0)
    const occupiedSlots = slotStats.filter((s: SlotStat) => s.isOccupied).reduce((sum: number, s: SlotStat) => sum + s._count, 0)
    const maintenanceSlots = slotStats.filter((s: SlotStat) => s.status === 'MAINTENANCE').reduce((sum: number, s: SlotStat) => sum + s._count, 0)

    // Get today's stats
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [todayTokens, todayTransactions] = await Promise.all([
      prisma.token.count({
        where: {
          parkingLotId: id,
          entryTime: { gte: today },
        },
      }),
      prisma.transaction.aggregate({
        where: {
          parkingLotId: id,
          createdAt: { gte: today },
          paymentStatus: 'COMPLETED',
        },
        _sum: { netAmount: true },
        _count: true,
      }),
    ])

    return successResponse({
      ...parkingLot,
      stats: {
        totalSlots,
        occupiedSlots,
        availableSlots: totalSlots - occupiedSlots - maintenanceSlots,
        maintenanceSlots,
        occupancyRate: totalSlots > 0 ? ((occupiedSlots / totalSlots) * 100).toFixed(1) : 0,
        todayEntries: todayTokens,
        todayRevenue: todayTransactions._sum.netAmount || 0,
        todayTransactions: todayTransactions._count,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/parking-lots/[id] - Update a parking lot
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN or SUPER_ADMIN can modify parking lots
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const data = updateParkingLotSchema.parse(body)

    const parkingLot = await prisma.parkingLot.update({
      where: { id },
      data: {
        ...data,
        operatingHours: data.operatingHours as object | undefined,
      },
      include: {
        organization: true,
      },
    })

    return successResponse(parkingLot, 'Parking lot updated successfully')
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/parking-lots/[id] - Delete a parking lot
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN or SUPER_ADMIN can delete parking lots
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    await prisma.parkingLot.delete({
      where: { id },
    })

    return successResponse(null, 'Parking lot deleted successfully')
  } catch (error) {
    return handleApiError(error)
  }
}
