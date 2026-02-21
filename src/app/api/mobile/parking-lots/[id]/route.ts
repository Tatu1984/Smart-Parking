import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { getAuthUser } from '@/lib/auth/getAuthUser'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) return errorResponse('Unauthorized', 401)

    const { id } = await params

    const lot = await prisma.parkingLot.findUnique({
      where: { id },
      include: {
        zones: {
          include: {
            slots: {
              select: { id: true, slotNumber: true, isOccupied: true, status: true, slotType: true, vehicleType: true },
            },
          },
        },
        pricingRules: {
          where: { isActive: true },
          select: { hourlyRate: true, baseRate: true, name: true, pricingModel: true },
          orderBy: { priority: 'desc' },
        },
      },
    })

    if (!lot) {
      return errorResponse('Parking lot not found', 404)
    }

    const allSlots = lot.zones.flatMap((z) => z.slots)
    const totalSpots = allSlots.length
    const availableSpots = allSlots.filter(
      (s) => !s.isOccupied && s.status === 'AVAILABLE'
    ).length
    const defaultRule = lot.pricingRules[0]
    const ratePerHour = defaultRule ? (defaultRule.hourlyRate ?? defaultRule.baseRate) / 100 : 0

    return successResponse({
      id: lot.id,
      name: lot.name,
      address: lot.address || '',
      latitude: lot.latitude || 0,
      longitude: lot.longitude || 0,
      totalSpots,
      availableSpots,
      ratePerHour,
      zones: lot.zones.map((z) => ({
        id: z.id,
        name: z.name,
        code: z.code,
        level: z.level,
        type: z.zoneType,
        totalSlots: z.slots.length,
        availableSlots: z.slots.filter((s) => !s.isOccupied && s.status === 'AVAILABLE').length,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
