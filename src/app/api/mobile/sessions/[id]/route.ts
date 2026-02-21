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

    const token = await prisma.token.findUnique({
      where: { id },
      include: {
        allocatedSlot: {
          include: { zone: { select: { name: true, code: true } } },
        },
        parkingLot: {
          select: { id: true, name: true, address: true, latitude: true, longitude: true },
        },
        vehicle: {
          select: { id: true, userId: true, licensePlate: true, vehicleType: true, make: true, model: true, color: true, isDefault: true },
        },
        transactions: {
          select: { netAmount: true, paymentMethod: true },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!token) {
      return errorResponse('Session not found', 404)
    }

    // Verify the user owns the vehicle
    if (token.vehicle?.userId !== user.id) {
      return errorResponse('Session not found', 404)
    }

    const transaction = token.transactions?.[0]
    const BACKEND_TO_MOBILE_TYPE: Record<string, string> = {
      CAR: 'car', MOTORCYCLE: 'motorcycle', SUV: 'suv', TRUCK: 'truck',
    }

    return successResponse({
      id: token.id,
      userId: user.id,
      vehicleId: token.vehicleId || '',
      lotId: token.parkingLotId,
      spotNumber: token.allocatedSlot?.slotNumber || '',
      zone: token.allocatedSlot?.zone?.name || '',
      status: token.status === 'ACTIVE' ? 'active' : token.status === 'COMPLETED' ? 'completed' : 'cancelled',
      startTime: token.entryTime.toISOString(),
      endTime: token.exitTime?.toISOString() || null,
      amount: transaction ? transaction.netAmount / 100 : 0,
      paymentMethod: transaction?.paymentMethod || '',
      vehicle: token.vehicle ? {
        id: token.vehicle.id,
        userId: token.vehicle.userId || '',
        licensePlate: token.vehicle.licensePlate,
        type: BACKEND_TO_MOBILE_TYPE[token.vehicle.vehicleType] || 'car',
        make: token.vehicle.make || '',
        model: token.vehicle.model || '',
        color: token.vehicle.color || '',
        isDefault: token.vehicle.isDefault,
      } : undefined,
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
    })
  } catch (error) {
    return handleApiError(error)
  }
}
