import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { getAuthUser } from '@/lib/auth/getAuthUser'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return errorResponse('Unauthorized', 401)

    const lots = await prisma.parkingLot.findMany({
      where: { status: 'ACTIVE' },
      include: {
        zones: {
          include: {
            slots: {
              select: { id: true, isOccupied: true, status: true },
            },
          },
        },
        pricingRules: {
          where: { isActive: true },
          select: { hourlyRate: true, baseRate: true },
          orderBy: { priority: 'desc' },
          take: 1,
        },
      },
    })

    const result = lots.map((lot) => {
      const allSlots = lot.zones.flatMap((z) => z.slots)
      const totalSpots = allSlots.length
      const availableSpots = allSlots.filter(
        (s) => !s.isOccupied && s.status === 'AVAILABLE'
      ).length
      const rule = lot.pricingRules[0]
      const ratePerHour = rule ? (rule.hourlyRate ?? rule.baseRate) / 100 : 0

      return {
        id: lot.id,
        name: lot.name,
        address: lot.address || '',
        latitude: lot.latitude || 0,
        longitude: lot.longitude || 0,
        totalSpots,
        availableSpots,
        ratePerHour,
      }
    })

    return successResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}
