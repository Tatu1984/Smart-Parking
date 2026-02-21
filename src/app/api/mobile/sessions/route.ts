import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/utils/api'
import { getAuthUser } from '@/lib/auth/getAuthUser'

function mapTokenToSession(token: {
  id: string
  vehicleId: string | null
  parkingLotId: string
  allocatedSlotId: string | null
  status: string
  entryTime: Date
  exitTime: Date | null
  licensePlate: string | null
  vehicleType: string | null
  allocatedSlot?: { slotNumber: string; zone: { name: string; code: string } } | null
  parkingLot: { id: string; name: string; address: string | null; latitude: number | null; longitude: number | null }
  transactions?: { netAmount: number; paymentMethod: string | null }[]
}) {
  const transaction = token.transactions?.[0]
  return {
    id: token.id,
    userId: '',
    vehicleId: token.vehicleId || '',
    lotId: token.parkingLotId,
    spotNumber: token.allocatedSlot?.slotNumber || '',
    zone: token.allocatedSlot?.zone?.name || token.allocatedSlot?.zone?.code || '',
    status: token.status === 'ACTIVE' ? 'active' : token.status === 'COMPLETED' ? 'completed' : 'cancelled',
    startTime: token.entryTime.toISOString(),
    endTime: token.exitTime?.toISOString() || null,
    amount: transaction ? transaction.netAmount / 100 : 0,
    paymentMethod: transaction?.paymentMethod || '',
    lot: {
      id: token.parkingLot.id,
      name: token.parkingLot.name,
      address: token.parkingLot.address || '',
      latitude: token.parkingLot.latitude || 0,
      longitude: token.parkingLot.longitude || 0,
      totalSpots: 0,
      availableSpots: 0,
      ratePerHour: 0,
    },
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return errorResponse('Unauthorized', 401)

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')

    // Get all user's vehicles
    const vehicles = await prisma.vehicle.findMany({
      where: { userId: user.id },
      select: { id: true },
    })
    const vehicleIds = vehicles.map((v) => v.id)

    if (vehicleIds.length === 0) {
      return successResponse([])
    }

    const whereClause: Record<string, unknown> = {
      vehicleId: { in: vehicleIds },
    }

    if (statusFilter === 'ACTIVE') {
      whereClause.status = 'ACTIVE'
    } else if (statusFilter === 'COMPLETED') {
      whereClause.status = 'COMPLETED'
    }

    const tokens = await prisma.token.findMany({
      where: whereClause,
      include: {
        allocatedSlot: {
          include: { zone: { select: { name: true, code: true } } },
        },
        parkingLot: {
          select: { id: true, name: true, address: true, latitude: true, longitude: true },
        },
        transactions: {
          select: { netAmount: true, paymentMethod: true },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { entryTime: 'desc' },
      take: 50,
    })

    return successResponse(tokens.map(mapTokenToSession))
  } catch (error) {
    return handleApiError(error)
  }
}
